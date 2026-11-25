import { replay, teamOf, type RoleId, type Winner } from '@sus/engine';
import type { Saved } from '../App';
import { RoleArt } from '../art/RoleArt';
import { Button, Card, Screen, TEAM_TEXT } from '../components/ui';
import { stepSummary } from '../lib/describe';
import { SKINS } from '../skins';

const HERO: Record<Winner, RoleId> = {
  village: 'villager',
  mafia: 'godfather',
  serialKiller: 'serialKiller',
  jester: 'jester',
  draw: 'villager',
};

export function GameOver({
  saved,
  onRematch,
  onHome,
  onResume,
}: {
  saved: Saved;
  onRematch: () => void;
  onHome: () => void;
  onResume: () => void;
}) {
  const { game } = saved;
  const skin = SKINS[saved.skin];
  const winner = game.ended!;
  const final = replay(game.setup, game.steps.slice(0, game.cursor + 1)).states.at(-1)!;

  return (
    <Screen>
      <div className="mt-6 flex flex-col items-center text-center animate-rise">
        <RoleArt role={HERO[winner]} skin={saved.skin} className="h-40 w-40 animate-float" />
        <h1 className="mt-2 text-4xl font-black">{skin.wins[winner]}</h1>
        {final.jesterWon && winner !== 'jester' && <p className="mt-1 font-bold text-neutral">…and the {skin.roles.jester.name} won too.</p>}
      </div>

      <Card className="mt-6">
        <div className="mb-3 text-xs font-black uppercase tracking-widest text-haze">Who was who</div>
        <ul className="grid grid-cols-2 gap-2">
          {game.setup.players.map((p) => {
            const role = game.setup.roles[p.id]!;
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-night-800 p-2">
                <RoleArt role={role} skin={saved.skin} dead={!final.alive[p.id]} className="h-10 w-10 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{p.name}</div>
                  <div className={`truncate text-xs font-bold ${TEAM_TEXT[teamOf(role)]}`}>{skin.roles[role].name}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-3">
        <div className="mb-3 text-xs font-black uppercase tracking-widest text-haze">How it went</div>
        <ol className="space-y-2 text-sm">
          {game.steps.slice(0, game.cursor + 1).map((_, i) => {
            const s = stepSummary(game, i, final.deaths, skin);
            return (
              <li key={i}>
                <span className="font-extrabold">{s.title}</span> <span className="text-mist">· {s.text}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        <Button className="h-14 text-lg" onClick={onRematch}>
          Rematch
        </Button>
        <div className="flex gap-3">
          <Button tone="ghost" className="flex-1" onClick={onResume}>
            Back to game
          </Button>
          <Button tone="ghost" className="flex-1" onClick={onHome}>
            Home
          </Button>
        </div>
      </div>
    </Screen>
  );
}
