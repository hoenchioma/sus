import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, RoomView } from '@sus/engine';

type Status = 'connecting' | 'needJoin' | 'live' | 'missing' | 'quota';

/** The server's free daily storage allowance is used up; phone games work again at `resetAt`. */
export class QuotaError extends Error {
  constructor(readonly resetAt: number) {
    super('Server storage quota used up');
  }
}

async function quotaFrom(res: Response): Promise<QuotaError | null> {
  if (res.status !== 503) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string; resetAt?: number };
  return body.error === 'quota' ? new QuotaError(body.resetAt ?? Date.now()) : null;
}

/** A clock time in the viewer's own timezone, with Bangla digits for Bangla. */
export const formatClock = (at: number, lang: 'en' | 'bn' = 'en') =>
  new Date(at).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : [], { hour: 'numeric', minute: '2-digit' });

const tokenKey = (code: string) => `sus.token.${code}`;

function readToken(code: string) {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

function saveToken(code: string, token: string) {
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    // Without storage the player can still use a rejoin code from the host.
  }
}

export async function createRoom(options: { game?: 'mafia' | 'quest'; skin?: string } = {}): Promise<string> {
  const res = await fetch('/api/rooms', { method: 'POST', body: JSON.stringify(options) });
  const quota = await quotaFrom(res);
  if (quota) throw quota;
  if (!res.ok) throw new Error('Could not create a room');
  return ((await res.json()) as { code: string }).code;
}

export function useRoom<V = RoomView, C = Command>(code: string, as: 'player' | 'tv') {
  const [view, setView] = useState<V | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [quotaResetAt, setQuotaResetAt] = useState<number | null>(null);
  const [storageFullUntil, setStorageFullUntil] = useState<number | null>(null);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const params = new URLSearchParams();
      if (as === 'tv') params.set('tv', '1');
      const token = readToken(code);
      if (token && as === 'player') params.set('token', token);
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws?${params}`);
      socket.current = ws;

      let lastHeard = Date.now();
      const heartbeat = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        // A socket that has gone quiet may be half-open; replace it so the phone doesn't freeze on an old screen.
        if (Date.now() - lastHeard > 30_000) ws.close();
        else ws.send(JSON.stringify({ type: 'ping' }));
      }, 10_000);
      ws.addEventListener('close', () => clearInterval(heartbeat));
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = (e) => {
        lastHeard = Date.now();
        const msg = JSON.parse(e.data as string);
        if (msg.type === 'pong') return;
        if (msg.type === 'view') {
          setView(msg.view);
          setClockOffset(msg.now - Date.now());
          setStorageFullUntil(msg.storageFullUntil ?? null);
          setStatus('live');
        } else if (msg.type === 'quota') {
          // Reconnecting can't help until the quota resets, so stop trying.
          closed = true;
          setQuotaResetAt(msg.resetAt);
          setStatus('quota');
        } else if (msg.type === 'needJoin') {
          setStatus('needJoin');
        } else if (msg.type === 'joined') {
          saveToken(code, msg.token);
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      };
      ws.onclose = (e) => {
        if (closed) return;
        if (e.code === 1006 && retry > 6) setStatus('missing');
        retry += 1;
        timer = setTimeout(connect, Math.min(5000, 500 * retry));
      };
    };

    fetch(`/api/rooms/${code}`).then(async (res) => {
      if (closed) return;
      const quota = await quotaFrom(res);
      if (quota) {
        setQuotaResetAt(quota.resetAt);
        setStatus('quota');
      } else if (res.status === 404) setStatus('missing');
      else connect();
    });

    return () => {
      closed = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [code, as]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  const sendRaw = useCallback((msg: unknown) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(msg));
  }, []);

  return {
    view,
    status,
    error,
    clockOffset,
    quotaResetAt,
    storageFullUntil,
    send: useCallback((command: C) => sendRaw({ type: 'command', command }), [sendRaw]),
    join: useCallback((name: string) => sendRaw({ type: 'join', name }), [sendRaw]),
    rejoin: useCallback((rejoinCode: string) => sendRaw({ type: 'rejoin', code: rejoinCode }), [sendRaw]),
  };
}

/** Seconds left until a server deadline, ticking every half second. */
export function useSecondsLeft(deadline: number | null, clockOffset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + clockOffset)) / 1000));
}

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export async function roomGame(code: string): Promise<'mafia' | 'quest' | null> {
  const res = await fetch(`/api/rooms/${code}`);
  const quota = await quotaFrom(res);
  if (quota) throw quota;
  if (!res.ok) return null;
  return ((await res.json()) as { game?: 'mafia' | 'quest' }).game ?? 'mafia';
}
