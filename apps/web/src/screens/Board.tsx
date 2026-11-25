import { useMemo, useState } from 'react';
import {
  callDeadRoles,
  detectiveResult,
  endGame,
  goTo,
  nightPrompts,
  phaseOf,
  previewNight,
  replay,
  setStep,
  targetProblem,
  view,
  voteInfo,
  type DayStep,
  type Game,
  type NightPrompt,
  type NightStep,
  type PlayerId,
  type RoleId,
  type Winner,
} from '@sus/engine';
import type { Saved } from '../App';
import { RoleArt } from '../art/RoleArt';
import { Button, Card, Chip, Countdown, HoldButton, Screen, Sheet } from '../components/ui';
import { deathLabel, describeEvents, nameOf, stepSummary } from '../lib/describe';
import { useWakeLock } from '../lib/wakeLock';
import { SKINS, type Skin } from '../skins';

const CAUSE_TEXT: Record<string, string> = {
  mafia: 'killed at night',
  serialKiller: 'killed at night',
  vigilante: 'shot at night',
  guarding: 'died guarding someone',
  heartbreak: 'died of heartbreak',
  vote: 'voted out',
  host: 'removed by the host',
};

export function Board({ saved, update, onQuit }: { saved: Saved; update: (game: Game) => void; onQuit: () => void }) {
  useWakeLock();
  const { game } = saved;
  const skin = SKINS[saved.skin];
  const v = useMemo(() => view(game), [game]);
  const index = game.cursor;
  const phase = phaseOf(index);
  const step = game.steps[index]!;
  const [sheet, setSheet] = useState<'players' | 'timeline' | null>(null);
  const [dismissedWin, setDismissedWin] = useState<string | null>(null);

  const setCurrent = (s: typeof step) => update(setStep(game, index, s));
  const alive = game.setup.players.filter((p) => v.state.alive[p.id]).length;
  const winKey = `${index}:${v.winnerAfter}`;

  return (
    <Screen>
      <header className="mb-4 flex items-center gap-2">
        <button className="h-10 w-10 rounded-full bg-night-700 text-lg" aria-label="Home" onClick={onQuit}>
          ⌂
        </button>
        <div className="flex-1 text-center">
          <div className="text-2xl font-black">
            {phase.kind === 'night' ? '🌙' : '☀️'} {phase.kind === 'night' ? 'Night' : 'Day'} {phase.number}
          </div>
          <div className="text-xs font-bold text-mist">
            {alive} alive · {game.setup.players.length - alive} dead
          </div>
        </div>
        <button className="h-10 rounded-full bg-night-700 px-3 text-sm font-bold" onClick={() => setSheet('timeline')}>
          Log
        </button>
        <button className="relative h-10 rounded-full bg-night-700 px-3 text-sm font-bold" onClick={() => setSheet('players')}>
          Players
          {v.issues.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-sun" />}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 animate-rise" key={index}>
        {step.kind === 'night' ? (
          <NightPanel game={game} step={step} skin={skin} skinId={saved.skin} setStep={setCurrent} />
        ) : (
          <DayPanel game={game} step={step} skin={skin} setStep={setCurrent} />
        )}

        {v.winnerAfter && dismissedWin !== winKey && (
          <WinBanner
            winner={v.winnerAfter}
            skin={skin}
            onEnd={() => update(endGame(game, v.winnerAfter!))}
            onContinue={() => setDismissedWin(winKey)}
          />
        )}
      </div>

      <div className="sticky bottom-0 mt-5 flex gap-3 bg-gradient-to-t from-night-900 via-night-900/95 to-transparent pt-4">
        {index > 0 && (
          <Button tone="ghost" className="h-14 px-5" onClick={() => update(goTo(game, index - 1))} aria-label="Previous step">
            ‹ Back
          </Button>
        )}
        <Button className="h-14 flex-1 text-lg" onClick={() => update(goTo(game, index + 1))}>
          {phase.kind === 'night' ? 'Morning ☀️' : 'Night falls 🌙'}
        </Button>
      </div>

      <PlayersSheet open={sheet === 'players'} onClose={() => setSheet(null)} game={game} skin={skin} skinId={saved.skin} update={update} />
      <TimelineSheet open={sheet === 'timeline'} onClose={() => setSheet(null)} game={game} skin={skin} update={update} />
    </Screen>
  );
}

function promptArt(game: Game, prompt: NightPrompt): RoleId {
  if (prompt.key !== 'mafia') return prompt.key;
  return prompt.holders.some((id) => game.setup.roles[id] === 'godfather') ? 'godfather' : 'mafia';
}

function NightPanel({
  game,
  step,
  skin,
  skinId,
  setStep,
}: {
  game: Game;
  step: NightStep;
  skin: Skin;
  skinId: Saved['skin'];
  setStep: (s: NightStep) => void;
}) {
  const v = view(game);
  const night = phaseOf(game.cursor).number;
  const prompts = nightPrompts(game.setup, v.state, night, v.rules).filter((p) => p.alive || callDeadRoles(v.rules));
  const preview = previewNight(game, game.cursor);
  const lines = describeEvents(preview.events, game.setup, skin);
  const deaths = step.overrideDeaths ?? preview.deaths.map((d) => d.player);
  const [editDeaths, setEditDeaths] = useState(false);

  const setAction = (key: NightPrompt['key'], target: PlayerId | null) =>
    setStep({ ...step, actions: { ...step.actions, [key]: target } });

  return (
    <>
      <p className="text-center text-sm text-mist">Everyone closes their eyes. Call each role in order.</p>
      {prompts.map((prompt) => (
        <PromptCard
          key={prompt.key}
          game={game}
          prompt={prompt}
          skin={skin}
          skinId={skinId}
          art={promptArt(game, prompt)}
          target={step.actions[prompt.key]}
          onPick={(t) => setAction(prompt.key, t)}
        />
      ))}

      <Card className="mt-1">
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-haze">What happened</div>
        {lines.length ? (
          <ul className="space-y-1 text-sm text-mist">
            {lines.map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mist">Nothing yet.</p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-haze">Dies tonight</div>
            <div className={`text-lg font-black ${deaths.length ? 'text-mafia' : 'text-village'}`}>
              {deaths.length ? deaths.map((id) => nameOf(game.setup, id)).join(', ') : 'Nobody'}
            </div>
            {step.overrideDeaths && <div className="text-xs font-bold text-sun">Set by host</div>}
          </div>
          <Button tone="ghost" className="min-h-10 text-sm" onClick={() => setEditDeaths(true)}>
            Change
          </Button>
        </div>
      </Card>

      <Sheet open={editDeaths} onClose={() => setEditDeaths(false)} title="Who actually died?">
        <div className="flex flex-wrap gap-2">
          {game.setup.players
            .filter((p) => v.state.alive[p.id])
            .map((p) => (
              <Chip
                key={p.id}
                active={deaths.includes(p.id)}
                onClick={() =>
                  setStep({
                    ...step,
                    overrideDeaths: deaths.includes(p.id) ? deaths.filter((d) => d !== p.id) : [...deaths, p.id],
                  })
                }
              >
                {p.name}
              </Chip>
            ))}
        </div>
        {step.overrideDeaths && (
          <Button tone="quiet" className="mt-4" onClick={() => setStep({ ...step, overrideDeaths: undefined })}>
            Use the app's result
          </Button>
        )}
      </Sheet>
    </>
  );
}

function PromptCard({
  game,
  prompt,
  skin,
  skinId,
  art,
  target,
  onPick,
}: {
  game: Game;
  prompt: NightPrompt;
  skin: Skin;
  skinId: Saved['skin'];
  art: RoleId;
  target: PlayerId | null | undefined;
  onPick: (t: PlayerId | null) => void;
}) {
  const v = view(game);
  const [fakeWait] = useState(() => 5 + Math.floor(Math.random() * 6));
  const [waiting, setWaiting] = useState(false);
  const holders = prompt.holders.map((id) => nameOf(game.setup, id)).join(' & ');
  const result = target && prompt.key === 'detective' ? detectiveResult(game.setup, target, v.rules) : null;

  return (
    <Card className={`!p-4 ${prompt.disabled ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3">
        <RoleArt role={art} skin={skinId} dead={!prompt.alive} className="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold leading-tight">{skin.prompts[prompt.key]}</div>
          <div className="line-clamp-2 text-xs leading-tight text-mist">{holders}</div>
        </div>
        {target !== undefined && !prompt.disabled && <span className="text-xl text-village">✓</span>}
      </div>

      {!prompt.alive ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-night-800 px-4 py-3 text-sm">
          <span className="text-mist">Dead · call it anyway so nobody can tell</span>
          {waiting ? (
            <span className="font-black text-sun">
              <Countdown seconds={fakeWait} onDone={() => setWaiting(false)} />
            </span>
          ) : (
            <button className="font-bold text-sky" onClick={() => setWaiting(true)}>
              Fake wait
            </button>
          )}
        </div>
      ) : prompt.disabled ? (
        <p className="mt-3 rounded-2xl bg-night-800 px-4 py-3 text-sm text-mist">{prompt.disabled}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {game.setup.players
              .filter((p) => v.state.alive[p.id])
              .map((p) => {
                const problem = targetProblem(game.setup, v.state, prompt.key, p.id, v.rules);
                return (
                  <Chip key={p.id} active={target === p.id} disabled={!!problem} title={problem ?? undefined} onClick={() => onPick(p.id)}>
                    {p.name}
                  </Chip>
                );
              })}
            <Chip active={target === null} onClick={() => onPick(null)}>
              No action
            </Chip>
          </div>
          {result && (
            <div className={`mt-3 rounded-2xl px-4 py-3 text-center text-lg font-black ${result === 'mafia' ? 'bg-mafia/15 text-mafia' : 'bg-village/15 text-village'}`}>
              {result === 'mafia' ? `👎 ${skin.teams.mafia}` : `👍 Not ${skin.teams.mafia}`}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function DayPanel({ game, step, skin, setStep }: { game: Game; step: DayStep; skin: Skin; setStep: (s: DayStep) => void }) {
  const v = view(game);
  const { setup } = game;
  const info = voteInfo(setup, v.state, v.rules);
  const nightDeaths = v.state.deaths.filter((d) => d.step === game.cursor - 1);
  const living = setup.players.filter((p) => v.state.alive[p.id]);
  const mayor = setup.players.find((p) => setup.roles[p.id] === 'mayor' && v.state.alive[p.id]);
  const [tied, setTied] = useState<PlayerId[] | null>(null);

  const eliminate = (ids: PlayerId[]) => setStep({ ...step, eliminated: ids });
  const toggleTied = (id: PlayerId) =>
    setTied((t) => (t?.includes(id) ? t.filter((x) => x !== id) : [...(t ?? []), id].slice(-2)));

  const resolveTie = () => {
    if (!tied || tied.length !== 2) return;
    if (v.rules.tieBreak === 'bothDie') eliminate(tied);
    else if (v.rules.tieBreak === 'random') eliminate([tied[Math.floor(Math.random() * 2)]!]);
    else if (v.rules.tieBreak === 'nobody') eliminate([]);
    setTied(null);
  };

  return (
    <>
      <Card>
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-haze">This morning</div>
        {nightDeaths.length === 0 ? (
          <p className="text-lg font-black text-village">Everyone woke up. Nobody died.</p>
        ) : (
          <ul className="space-y-2">
            {nightDeaths.map((d) => {
              const label = deathLabel(d, setup, v.rules, skin);
              return (
                <li key={d.player}>
                  <span className="text-lg font-black text-mafia">{nameOf(setup, d.player)}</span>
                  <span className="font-bold"> died{label ? ` · ${label}` : ''}</span>
                  <div className="text-xs text-haze">Host only: {CAUSE_TEXT[d.cause]}</div>
                </li>
              );
            })}
          </ul>
        )}
        {info.blockedPartner && (
          <p className="mt-3 rounded-2xl bg-rose/15 px-4 py-2 text-sm font-bold text-rose">
            💗 {nameOf(setup, info.blockedPartner)} spent the night with the {skin.roles.lover.name} and can't vote today.
          </p>
        )}
      </Card>

      <Card className="text-center">
        <div className="text-xs font-black uppercase tracking-widest text-haze">Vote</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Stat label="Alive" value={info.alive} />
          <Stat label="Votes" value={info.votes} />
          <Stat label="Needed" value={info.needed ?? 'Most'} highlight />
        </div>
        {info.ghostsAvailable.length > 0 && (
          <div className="mt-4 text-left">
            <div className="text-sm font-bold text-neutral">Ghost votes used today</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {info.ghostsAvailable.map((id) => {
                const used = step.ghostVotes?.includes(id) ?? false;
                return (
                  <Chip
                    key={id}
                    active={used}
                    onClick={() =>
                      setStep({ ...step, ghostVotes: used ? step.ghostVotes!.filter((g) => g !== id) : [...(step.ghostVotes ?? []), id] })
                    }
                  >
                    👻 {nameOf(setup, id)}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}
        {mayor && !v.state.mayorRevealed && (
          <label className="mt-4 flex items-center justify-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={!!step.mayorRevealed} onChange={(e) => setStep({ ...step, mayorRevealed: e.target.checked })} />
            {mayor.name} revealed as {skin.roles.mayor.name} (vote counts twice)
          </label>
        )}
      </Card>

      <Card>
        <div className="mb-3 text-xs font-black uppercase tracking-widest text-haze">Voted out</div>
        <div className="flex flex-wrap gap-1.5">
          {living.map((p) => (
            <Chip key={p.id} active={step.eliminated.includes(p.id)} onClick={() => eliminate(step.eliminated.includes(p.id) ? [] : [p.id])}>
              {p.name}
            </Chip>
          ))}
          <Chip active={step.eliminated.length === 0} onClick={() => eliminate([])}>
            Nobody
          </Chip>
        </div>

        {step.eliminated.map((id) => {
          const role = setup.roles[id]!;
          const label = deathLabel({ player: id, cause: 'vote', step: game.cursor }, setup, v.rules, skin);
          return (
            <p key={id} className="mt-3 font-bold">
              {nameOf(setup, id)} is out{label ? ` · ${label}` : ''}
              {role === 'jester' && <span className="text-neutral"> · the {skin.roles.jester.name} got what they wanted!</span>}
            </p>
          );
        })}

        <div className="mt-4 rounded-2xl bg-night-800 p-3">
          {tied === null ? (
            <button className="text-sm font-bold text-sky" onClick={() => setTied([])}>
              No majority or a tie? Run a runoff →
            </button>
          ) : (
            <>
              <p className="text-sm text-mist">Pick the top two. Revote between only them; most votes is out. Still tied?</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {living.map((p) => (
                  <Chip key={p.id} active={tied.includes(p.id)} onClick={() => toggleTied(p.id)}>
                    {p.name}
                  </Chip>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                {v.rules.tieBreak !== 'host' && (
                  <Button className="min-h-10 flex-1 text-sm" disabled={tied.length !== 2} onClick={resolveTie}>
                    {{ bothDie: 'Still tied: both out', random: 'Still tied: pick at random', nobody: 'Still tied: nobody out', host: '' }[v.rules.tieBreak]}
                  </Button>
                )}
                <Button tone="ghost" className="min-h-10 text-sm" onClick={() => setTied(null)}>
                  Close
                </Button>
              </div>
              {v.rules.tieBreak === 'host' && <p className="mt-2 text-xs text-mist">House rule: the host picks who's out above.</p>}
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl py-3 ${highlight ? 'bg-sky/15 text-sky' : 'bg-night-800'}`}>
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-mist">{label}</div>
    </div>
  );
}

function WinBanner({ winner, skin, onEnd, onContinue }: { winner: Winner; skin: Skin; onEnd: () => void; onContinue: () => void }) {
  return (
    <Card className="ring-2 ring-sun/60 animate-rise">
      <div className="text-xs font-black uppercase tracking-widest text-sun">Game over?</div>
      <div className="mt-1 text-2xl font-black">{skin.wins[winner]}</div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onEnd}>
          End game
        </Button>
        <Button tone="ghost" onClick={onContinue}>
          Keep playing
        </Button>
      </div>
    </Card>
  );
}

function PlayersSheet({
  open,
  onClose,
  game,
  skin,
  skinId,
  update,
}: {
  open: boolean;
  onClose: () => void;
  game: Game;
  skin: Skin;
  skinId: Saved['skin'];
  update: (g: Game) => void;
}) {
  const [peek, setPeek] = useState(false);
  const v = view(game);
  const step = game.steps[game.cursor]!;

  const toggleAlive = (id: PlayerId) => {
    const adjust = { ...(step.adjust ?? {}) };
    const wasAlive = v.after.alive[id];
    if (adjust[id] !== undefined) delete adjust[id];
    else adjust[id] = !wasAlive;
    update(setStep(game, game.cursor, { ...step, adjust }));
  };

  return (
    <Sheet open={open} onClose={onClose} title="Players">
      {v.issues.map((issue) => (
        <button
          key={`${issue.step}-${issue.message}`}
          className="mb-2 block w-full rounded-2xl bg-sun/15 px-4 py-2 text-left text-sm font-bold text-sun"
          onClick={() => {
            update(goTo(game, issue.step));
            onClose();
          }}
        >
          ⚠ {stepSummary(game, issue.step, [], skin).title}: {issue.message} →
        </button>
      ))}
      <HoldButton onHold={setPeek} className="mb-3 w-full touch-none rounded-2xl bg-night-700 py-3 font-extrabold">
        {peek ? 'Showing roles…' : 'Hold to see roles'}
      </HoldButton>
      <ul className="flex flex-col gap-2">
        {game.setup.players.map((p) => {
          const alive = v.after.alive[p.id];
          const role = game.setup.roles[p.id]!;
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-night-700/60 p-2 pr-3">
              {peek ? (
                <RoleArt role={role} skin={skinId} dead={!alive} className="h-11 w-11" />
              ) : (
                <div className={`grid h-11 w-11 place-items-center rounded-full text-lg font-black ${alive ? 'bg-night-600' : 'bg-night-800 text-haze'}`}>
                  {p.name[0]}
                </div>
              )}
              <div className="flex-1">
                <div className={`font-bold ${alive ? '' : 'text-haze line-through'}`}>{p.name}</div>
                {peek && <div className="text-xs text-mist">{skin.roles[role].name}</div>}
              </div>
              <button className={`rounded-full px-3 py-1.5 text-xs font-bold ${alive ? 'bg-village/15 text-village' : 'bg-mafia/15 text-mafia'}`} onClick={() => toggleAlive(p.id)}>
                {alive ? 'Alive' : 'Dead'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-haze">Tap Alive/Dead to fix a mistake or remove someone who left. It applies from this step on.</p>
    </Sheet>
  );
}

function TimelineSheet({ open, onClose, game, skin, update }: { open: boolean; onClose: () => void; game: Game; skin: Skin; update: (g: Game) => void }) {
  if (!open) return null;
  const deaths = replay(game.setup, game.steps).states.at(-1)!.deaths;
  return (
    <Sheet open={open} onClose={onClose} title="Game log">
      <ol className="flex flex-col gap-2">
        {game.steps.map((_, i) => {
          const s = stepSummary(game, i, deaths, skin);
          return (
            <li key={i}>
              <button
                className={`w-full rounded-2xl px-4 py-3 text-left ring-1 ${i === game.cursor ? 'bg-night-600 ring-sky' : 'bg-night-700/60 ring-transparent'}`}
                onClick={() => {
                  update(goTo(game, i));
                  onClose();
                }}
              >
                <div className="font-extrabold">{s.title}</div>
                <div className="text-sm text-mist">{s.text}</div>
              </button>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
