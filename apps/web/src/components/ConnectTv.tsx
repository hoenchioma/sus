import { useState } from 'react';
import { Button, Card } from './ui';

export interface ConnectTvText {
  title: string;
  hint: (host: string) => string;
  placeholder: string;
  connect: string;
  connected: string;
  noTv: string;
  failed: string;
}

export const CONNECT_TV_EN: ConnectTvText = {
  title: 'Show it on a TV',
  hint: (host) => `Open ${host}/tv on the TV (or the Sus app on Fire TV) and type the code it shows.`,
  placeholder: 'TV code',
  connect: 'Connect',
  connected: 'TV connected',
  noTv: 'No TV is showing that code',
  failed: "Couldn't reach the TV. Try again.",
};

/** Lets the host send this room to a TV that's showing a pairing code. */
export function ConnectTv({ room, text, className = '' }: { room: string; text: ConnectTvText; className?: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/pair/${code}`, { method: 'POST', body: JSON.stringify({ room }) });
      setMessage(res.ok ? { ok: true, text: text.connected } : { ok: false, text: res.status === 404 ? text.noTv : text.failed });
      if (res.ok) setCode('');
    } catch {
      setMessage({ ok: false, text: text.failed });
    }
    setBusy(false);
  };

  return (
    <Card className={className}>
      <div className="text-xs font-black uppercase tracking-widest text-haze">📺 {text.title}</div>
      <p className="mt-1 text-sm text-mist">{text.hint(location.host)}</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 4) void connect();
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder={text.placeholder}
          aria-label={text.placeholder}
          className="min-h-12 w-32 rounded-2xl bg-night-700 px-4 text-center text-lg font-black tracking-[0.3em] text-ink outline-none ring-1 ring-white/10 placeholder:tracking-normal placeholder:text-haze focus:ring-sky"
        />
        <Button type="submit" className="flex-1" disabled={busy || code.length !== 4}>
          {text.connect}
        </Button>
      </form>
      {message && <p className={`mt-2 text-sm font-bold ${message.ok ? 'text-village' : 'text-mafia'}`}>{message.text}</p>}
    </Card>
  );
}
