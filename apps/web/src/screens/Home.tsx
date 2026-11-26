import { useState } from 'react';
import { RoleArt } from '../art/RoleArt';
import { Button, Screen } from '../components/ui';
import { createRoom, formatClock, QuotaError } from '../lib/room';
import { useStored } from '../lib/storage';
import { QuestArt } from '../art/QuestArt';

export function Home({ canContinue, onContinue, onNew }: { canContinue: boolean; onContinue: () => void; onNew: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useStored<'mafia' | 'quest'>('sus.homeGame', 'mafia');
  const [questSaved] = useStored<unknown>('sus.quest.game', null);

  const host = async () => {
    setBusy(true);
    setError(null);
    try {
      location.assign(`/play/${await createRoom(game === 'quest' ? { game: 'quest', skin: 'polashi' } : {})}`);
    } catch (e) {
      setError(
        e instanceof QuotaError
          ? `Phone games are paused until ${formatClock(e.resetAt)}: today's free server allowance is used up. One-phone games below still work.`
          : 'Could not reach the server. Check your connection.',
      );
      setBusy(false);
    }
  };

  return (
    <Screen className="justify-between">
      <div className="mt-[8vh] flex flex-col items-center text-center animate-rise">
        {game === 'mafia' ? (
          <div className="relative mb-2 flex -space-x-6">
            <RoleArt role="villager" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-2s]" />
            <RoleArt role="mafia" className="relative z-10 h-32 w-32 animate-float" />
            <RoleArt role="detective" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-4s]" />
          </div>
        ) : (
          <div className="relative mb-2 flex -space-x-6">
            <QuestArt card="siraj" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-2s]" />
            <QuestArt card="mirJafar" className="relative z-10 h-32 w-32 animate-float" />
            <QuestArt card="mirMadan" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-4s]" />
          </div>
        )}
        <h1 className="text-7xl font-black tracking-tight">
          Sus<span className="text-mafia">.</span>
        </h1>
        <p className="mt-3 max-w-xs text-mist">
          {game === 'mafia' ? 'Run Mafia & Werewolf nights without losing track of who did what.' : 'Polashi and Avalon: chapters, secret votes and one last guess.'}
        </p>
        <div className="mt-5 flex gap-1 rounded-full bg-night-800 p-1">
          {(
            [
              ['mafia', 'Mafia · Werewolf'],
              ['quest', 'পলাশী · Avalon'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setGame(id)}
              className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${game === id ? 'bg-sky text-night-950' : 'text-mist'}`}
            >
              {label}
            </button>
          ))}
        </div>
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
          {game === 'mafia' ? (
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
          ) : (
            <div className="flex gap-2">
              {questSaved !== null && (
                <Button tone="ghost" className="flex-1" onClick={() => location.assign('/quest')}>
                  Continue
                </Button>
              )}
              <Button
                tone={questSaved !== null ? 'ghost' : 'primary'}
                className="flex-1"
                onClick={() => {
                  try {
                    localStorage.removeItem('sus.quest.game');
                  } catch {
                    // Starting fresh works without storage too.
                  }
                  location.assign('/quest');
                }}
              >
                New game
              </Button>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
