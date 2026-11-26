import { useEffect, useState } from 'react';
import { RoleArt } from '../art/RoleArt';
import { useWakeLock } from '../lib/wakeLock';

const newCode = () => String(Math.floor(Math.random() * 10_000)).padStart(4, '0');

/** The TV's start screen: shows a code and waits for a host's phone to send it a room. */
export function TvPair() {
  const [code, setCode] = useState(newCode);
  const [online, setOnline] = useState(false);
  useWakeLock();

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    let ws: WebSocket;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/api/pair/${code}/ws`);
      const heartbeat = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 20_000);
      ws.onopen = () => setOnline(true);
      ws.onmessage = (e) => {
        if (e.data === 'pong') return;
        const msg = JSON.parse(e.data as string) as { type: string; room?: string };
        if (msg.type === 'paired' && msg.room) location.assign(`/tv/${msg.room}`);
        if (msg.type === 'taken') {
          closed = true;
          setCode(newCode());
        }
      };
      ws.onclose = () => {
        clearInterval(heartbeat);
        setOnline(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      ws.close();
    };
  }, [code]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[3vw] p-[4vw] text-center">
      <div className="flex -space-x-[2vw]">
        <RoleArt role="villager" className="h-[9vw] w-[9vw] translate-y-[1vw] animate-float [animation-delay:-2s]" />
        <RoleArt role="mafia" className="relative z-10 h-[12vw] w-[12vw] animate-float" />
        <RoleArt role="detective" className="h-[9vw] w-[9vw] translate-y-[1vw] animate-float [animation-delay:-4s]" />
      </div>
      <div className="text-[5vw] font-black leading-none">
        Sus<span className="text-mafia">.</span>
      </div>
      <div>
        <p className="text-[2.2vw] font-bold text-mist">On the host's phone, tap Connect TV and enter</p>
        <p className="font-bangla text-[1.8vw] text-haze">হোস্টের ফোনে টিভি যুক্ত করুন, তারপর এই কোডটি দিন</p>
      </div>
      <div className={`text-[13vw] font-black leading-none tracking-[0.15em] transition-opacity ${online ? '' : 'opacity-30'}`}>{code}</div>
      {!online && <p className="text-[1.6vw] font-bold text-haze">Connecting…</p>}
    </div>
  );
}
