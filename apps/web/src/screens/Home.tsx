import { useState } from 'react';
import { RoleArt } from '../art/RoleArt';
import { Button, Screen } from '../components/ui';
import { createRoom } from '../lib/room';

export function Home({ canContinue, onContinue, onNew }: { canContinue: boolean; onContinue: () => void; onNew: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = async () => {
    setBusy(true);
    setError(null);
    try {
      location.assign(`/play/${await createRoom()}`);
    } catch {
      setError('Could not reach the server. Check your connection.');
      setBusy(false);
    }
  };

  return (
    <Screen className="justify-between">
      <div className="mt-[8vh] flex flex-col items-center text-center animate-rise">
        <div className="relative mb-2 flex -space-x-6">
          <RoleArt role="villager" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-2s]" />
          <RoleArt role="mafia" className="relative z-10 h-32 w-32 animate-float" />
          <RoleArt role="detective" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-4s]" />
        </div>
        <h1 className="text-7xl font-black tracking-tight">
          Sus<span className="text-mafia">.</span>
        </h1>
        <p className="mt-3 max-w-xs text-mist">Run Mafia &amp; Werewolf nights without losing track of who did what.</p>
      </div>

      <div className="flex flex-col gap-3 animate-rise [animation-delay:120ms]">
        <div className="rounded-card bg-night-800/70 p-4 ring-1 ring-white/5">
          <div className="mb-3 text-xs font-black uppercase tracking-widest text-haze">Everyone on their phone</div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().length === 4) location.assign(`/play/${code.trim().toUpperCase()}`);
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase())}
              placeholder="CODE"
              aria-label="Room code"
              className="min-h-12 w-28 rounded-2xl bg-night-700 px-4 text-center text-lg font-black tracking-widest text-ink outline-none ring-1 ring-white/10 placeholder:text-haze focus:ring-sky"
            />
            <Button type="submit" tone="ghost" className="flex-1" disabled={code.length !== 4}>
              Join
            </Button>
            <Button type="button" className="flex-1" disabled={busy} onClick={host}>
              Host
            </Button>
          </form>
          {error && <p className="mt-2 text-sm font-bold text-mafia">{error}</p>}
        </div>

        <div className="rounded-card bg-night-800/70 p-4 ring-1 ring-white/5">
          <div className="mb-3 text-xs font-black uppercase tracking-widest text-haze">One phone · the host runs the night</div>
          <div className="flex gap-2">
            {canContinue && (
              <Button tone="ghost" className="flex-1" onClick={onContinue}>
                Continue
              </Button>
            )}
            <Button tone={canContinue ? 'ghost' : 'primary'} className="flex-1" onClick={onNew}>
              New tracker game
            </Button>
          </div>
        </div>
      </div>
    </Screen>
  );
}
