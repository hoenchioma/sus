// Anonymous game stats. Each phone keeps a random ID so the same phone can be recognised across games, and
// one-phone games are sent to the server once they end (queued while offline). Names are scrambled server-side.
import { useEffect } from 'react';
import type { TrackerUpload } from '@sus/engine';

const DEVICE_KEY = 'sus.device';
const QUEUE_KEY = 'sus.stats.queue';
const SENT_KEY = 'sus.stats.sent';

let memoryDevice: string | null = null;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: stats are best-effort.
  }
}

export function deviceId(): string {
  const saved = load<string | null>(DEVICE_KEY, null);
  if (saved) return saved;
  memoryDevice ??= crypto.randomUUID();
  store(DEVICE_KEY, memoryDevice);
  return memoryDevice;
}

/** The simulated-game tests mark their phones so their games can be left out of stats. */
export const isTestPhone = () => load<unknown>('sus.test', null) === true;

type Queued = TrackerUpload & { device: string };

let flushing = false;

export async function flushStats() {
  if (flushing) return;
  flushing = true;
  try {
    for (const upload of load<Queued[]>(QUEUE_KEY, [])) {
      let done: boolean;
      try {
        const res = await fetch('/api/stats/games', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(upload) });
        // A refused upload won't get better by retrying; only network and server trouble are worth another go.
        done = res.status < 500;
      } catch {
        done = false;
      }
      if (!done) break;
      store(QUEUE_KEY, load<Queued[]>(QUEUE_KEY, []).filter((q) => q.id !== upload.id));
    }
  } finally {
    flushing = false;
  }
}

/** Queues a finished one-phone game, once per ending (`key` changes if the game is reopened and ends again). */
function reportGame(upload: TrackerUpload, key: string) {
  const sent = load<string[]>(SENT_KEY, []);
  if (sent.includes(key)) return;
  store(SENT_KEY, [...sent, key].slice(-50));
  const queue = load<Queued[]>(QUEUE_KEY, []).filter((q) => q.id !== upload.id);
  store(QUEUE_KEY, [...queue, { ...upload, test: isTestPhone() || undefined, device: deviceId() }].slice(-20));
  void flushStats();
}

/** Sends a one-phone game when it ends; `upload` is null while it's still going. */
export function useReportGame(upload: TrackerUpload | null, key: string) {
  useEffect(() => {
    if (upload) reportGame(upload, key);
    // `key` captures everything about the ending that matters, so a new upload object alone doesn't resend.
  }, [upload === null, key]);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushStats());
  void flushStats();
}
