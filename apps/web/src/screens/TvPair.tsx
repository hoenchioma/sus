import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RoleArt } from '../art/RoleArt';
import { useWakeLock } from '../lib/wakeLock';

const newCode = () => String(Math.floor(Math.random() * 10_000)).padStart(4, '0');

/** The TV's start screen: shows a code and waits for a host's phone to send it a room. */
export function TvPair() {
  const [code, setCode] = useState(newCode);
  const [online, setOnline] = useState(false);
  const [qr, setQr] = useState('');
  useWakeLock();

  useEffect(() => {
    QRCode.toString(`${location.origin}/link/${code}`, { type: 'svg', margin: 0, color: { dark: '#eef1ff', light: '#00000000' } }).then(setQr);
  }, [code]);

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
    <div className="grid min-h-dvh grid-cols-2 items-center gap-[5vw] p-[5vw]">
      <div className="flex flex-col items-center gap-[1.5vw]">
        <div className={`w-[28vw] rounded-[2vw] bg-night-800 p-[2vw] transition-opacity ${online ? '' : 'opacity-30'}`} dangerouslySetInnerHTML={{ __html: qr }} />
        <div className={`text-[6vw] font-black leading-none tracking-[0.15em] transition-opacity ${online ? '' : 'opacity-30'}`}>{code}</div>
        {!online && <p className="text-[1.6vw] font-bold text-haze">Connecting…</p>}
      </div>
      <div className="flex flex-col gap-[2vw]">
        <div className="flex items-center gap-[1.5vw]">
          <RoleArt role="mafia" className="h-[7vw] w-[7vw] animate-float" />
          <div className="text-[5vw] font-black leading-none">
            Sus<span className="text-mafia">.</span>
          </div>
        </div>
        <div>
          <p className="text-[2.6vw] font-black leading-tight">Scan to play on this TV</p>
          <p className="mt-[0.6vw] text-[1.7vw] text-mist">The first to scan hosts; everyone after joins their game.</p>
          <p className="mt-[0.6vw] text-[1.5vw] text-haze">
            No camera? Type the code on <span className="text-ink">{location.host}</span> and tap Host. Already hosting? Enter it under “Show it on a TV” in the lobby.
          </p>
        </div>
        <div className="font-bangla">
          <p className="text-[2.2vw] font-bold leading-tight">এই টিভিতে খেলতে স্ক্যান করুন</p>
          <p className="text-[1.6vw] text-mist">প্রথমে যিনি স্ক্যান করবেন তিনি হোস্ট; পরে যারা স্ক্যান করবেন তারা সেই খেলায় যোগ দেবেন।</p>
        </div>
      </div>
    </div>
  );
}
