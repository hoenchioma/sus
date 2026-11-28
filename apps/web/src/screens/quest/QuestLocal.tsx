import { useEffect, useMemo, useState } from 'react';
import { quest } from '@sus/engine';
import type { Group } from '../../App';
import { CardBack } from '../../art/RoleArt';
import { QuestArt } from '../../art/QuestArt';
import { Button, Card, Chip, HoldButton, Screen } from '../../components/ui';
import { sayLine } from '../../lib/audio';
import { useStored } from '../../lib/storage';
import { useWakeLock } from '../../lib/wakeLock';
import { cardName, type QuestSkinId } from '../../skins/quest';
import { ChapterTrack, CharacterReveal, QuestSettingsPanel, RejectionTrack, SeatList, useQuestText, type QuestText } from './parts';
import { FullscreenButton } from '../../components/FullscreenButton';
import { useReportGame } from '../../lib/stats';

interface Draft {
  names: string[];
  rules: quest.QuestRuleChoices;
  preset: quest.QuestPresetId;
  skin: QuestSkinId;
  firstCommander: number | null;
}

interface Saved {
  stage: 'reveal' | 'ritual' | 'play';
  skin: QuestSkinId;
  setup: quest.QuestSetup;
  steps: quest.QuestStep[];
  /** Steps undone with Back, re-applied by Next. */
  redo: quest.QuestStep[];
  /** For stats: identifies this game and when it began. Older saves don't have them. */
  id?: string;
  startedAt?: number;
}

const emptyDraft: Draft = { names: [], rules: {}, preset: 'first', skin: 'polashi', firstCommander: null };

export function QuestLocal() {
  const [draft, setDraft] = useStored<Draft>('sus.quest.draft', emptyDraft);
  const [saved, setSaved] = useStored<Saved | null>('sus.quest.game', null);
  const [groups] = useStored<Group[]>('sus.groups', []);
  const text = useQuestText(saved?.skin ?? draft.skin);
  useWakeLock();

  if (!saved) {
    return (
      <SetupQuest
        draft={draft}
        setDraft={setDraft}
        groups={groups}
        text={text}
        onDeal={() => {
          const players = draft.names.map((name) => ({ id: crypto.randomUUID(), name }));
          const setup = quest.dealQuest(players, draft.rules, Math.random, quest.cardFaces(draft.skin), draft.firstCommander ?? undefined);
          setSaved({ stage: 'reveal', skin: draft.skin, setup, steps: [], redo: [], id: crypto.randomUUID(), startedAt: Date.now() });
        }}
      />
    );
  }
  if (saved.stage === 'reveal') return <PassReveal setup={saved.setup} text={text} onDone={() => setSaved({ ...saved, stage: 'ritual' })} />;
  if (saved.stage === 'ritual') return <Ritual setup={saved.setup} skin={saved.skin} text={text} onDone={() => setSaved({ ...saved, stage: 'play' })} />;
  return <Board saved={saved} setSaved={setSaved} text={text} onExit={() => setSaved(null)} />;
}

function SetupQuest({
  draft,
  setDraft,
  groups,
  text,
  onDeal,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  groups: Group[];
  text: QuestText;
  onDeal: () => void;
}) {
  const [name, setName] = useState('');
  const n = draft.names.length;
  const { t } = text;
  const add = () => {
    const v = name.trim();
    if (v && !draft.names.includes(v) && n < quest.MAX_QUEST_PLAYERS) setDraft({ ...draft, names: [...draft.names, v] });
    setName('');
  };
  const move = (i: number, by: number) => {
    const names = [...draft.names];
    const j = i + by;
    if (j < 0 || j >= names.length) return;
    [names[i], names[j]] = [names[j]!, names[i]!];
    setDraft({ ...draft, names });
  };

  return (
    <Screen className={text.font}>
      <header className="mb-4 flex items-center gap-3">
        <button className="h-10 w-10 rounded-full bg-night-700 text-xl" aria-label="Home" onClick={() => location.assign('/')}>
          ‹
        </button>
        <h1 className="flex-1 text-3xl font-black">{text.terms.game}</h1>
        <FullscreenButton />
      </header>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-haze">
            {t.players} · {text.num(n)}
          </div>
          {groups.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {groups.map((g) => (
                <Chip key={g.name} onClick={() => setDraft({ ...draft, names: g.names.slice(0, quest.MAX_QUEST_PLAYERS) })}>
                  {g.name}
                </Chip>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.playerName}
              maxLength={20}
              className="min-h-12 flex-1 rounded-2xl bg-night-700 px-4 font-bold text-ink outline-none ring-1 ring-white/10 placeholder:text-haze focus:ring-sky"
            />
            <Button type="submit" disabled={!name.trim()}>
              +
            </Button>
          </form>
          <ol className="mt-3 flex flex-col gap-1.5">
            {draft.names.map((p, i) => (
              <li key={p} className="flex items-center gap-2 rounded-2xl bg-night-800 px-3 py-2 font-bold">
                <span className="w-5 text-xs text-haze">{text.num(i + 1)}</span>
                <span className="flex-1">{p}</span>
                <button className="h-8 w-8 text-mist" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                <button className="h-8 w-8 text-mist" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                <button className="h-8 w-8 text-mafia" aria-label="Remove" onClick={() => setDraft({ ...draft, names: draft.names.filter((x) => x !== p) })}>✕</button>
              </li>
            ))}
          </ol>
        </Card>

        <QuestSettingsPanel
          players={n}
          rules={draft.rules}
          preset={draft.preset}
          skin={draft.skin}
          text={text}
          onChange={(p) => setDraft({ ...draft, ...p })}
          extra={
            <div className="rounded-2xl bg-night-800/70 p-4">
              <div className="mb-2 font-extrabold">{t.firstCommander}</div>
              <div className="flex flex-wrap gap-2">
                <Chip active={draft.firstCommander === null} onClick={() => setDraft({ ...draft, firstCommander: null })}>
                  {t.random}
                </Chip>
                {draft.names.map((p, i) => (
                  <Chip key={p} active={draft.firstCommander === i} onClick={() => setDraft({ ...draft, firstCommander: i })}>
                    {p}
                  </Chip>
                ))}
              </div>
            </div>
          }
        />
      </div>

      <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-night-900 via-night-900/95 to-transparent pt-4">
        <Button className="h-14 w-full text-lg" disabled={n < quest.MIN_QUEST_PLAYERS} onClick={onDeal}>
          {n < quest.MIN_QUEST_PLAYERS ? t.needPlayers(quest.MIN_QUEST_PLAYERS) : t.dealRoles}
        </Button>
      </div>
    </Screen>
  );
}

/** Passes the phone around: each player holds to see their character, then hands it on. */
function PassReveal({ setup, text, onDone }: { setup: quest.QuestSetup; text: QuestText; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(false);
  const player = setup.players[i];
  const { t } = text;
  if (!player) {
    return (
      <Screen className={`items-center justify-center text-center ${text.font}`}>
        <CardBack className="h-48 animate-float" />
        <h1 className="mt-6 text-3xl font-black">{t.ritual}</h1>
        <Button className="mt-8 h-14 w-full text-lg" onClick={onDone}>
          {t.next}
        </Button>
      </Screen>
    );
  }
  return (
    <Screen className={`items-center text-center ${text.font}`}>
      <p className="mt-4 text-sm font-bold text-haze">
        {text.num(i + 1)} / {text.num(setup.players.length)}
      </p>
      <h1 className="mt-1 text-4xl font-black">{t.passTo(player.name)}</h1>
      <p className="text-mist">{t.onlyThem(player.name)}</p>
      <HoldButton
        onHold={(h) => {
          setHeld(h);
          if (h) setSeen(true);
        }}
        className="mt-6 w-full max-w-[18rem] touch-none select-none"
      >
        <div className="min-h-[24rem] overflow-hidden rounded-[2rem] ring-1 ring-white/10">
          {held ? (
            <div className="flex min-h-[24rem] flex-col justify-center bg-gradient-to-b from-night-600 to-night-800 p-5">
              <CharacterReveal card={setup.cards[player.id]!} role={setup.roles[player.id]!} text={text} />
            </div>
          ) : (
            <div className="relative h-[24rem]">
              <CardBack className="h-full w-full" />
              <span className="absolute inset-x-0 bottom-6 text-sm font-extrabold">{t.holdToSee}</span>
            </div>
          )}
        </div>
      </HoldButton>
      <Button
        className="mt-6 h-14 w-full text-lg"
        disabled={!seen || held}
        onClick={() => {
          setI(i + 1);
          setSeen(false);
        }}
      >
        {t.done}
      </Button>
    </Screen>
  );
}

function Ritual({ setup, skin, text, onDone }: { setup: quest.QuestSetup; skin: QuestSkinId; text: QuestText; onDone: () => void }) {
  const lines = quest.ritualScript(setup);
  const [i, setI] = useState(-1);
  const [pause, setPause] = useStored('sus.quest.pause', 4);
  const [aloud, setAloud] = useStored('sus.quest.aloud', true);
  const { t } = text;
  const line = lines[i];

  useEffect(() => {
    if (i < 0 || i >= lines.length) return;
    if (aloud) sayLine(skin, text.lang, lines[i]!, t.ritualLines[lines[i]!] ?? '');
    const timer = setTimeout(() => setI(i + 1), pause * 1000);
    return () => clearTimeout(timer);
  }, [i, aloud, pause, lines, skin, text.lang, t.ritualLines]);

  return (
    <Screen className={`justify-center text-center ${text.font}`}>
      <h1 className="text-3xl font-black">{t.ritual}</h1>
      <Card className="mt-6 flex min-h-48 items-center justify-center text-2xl font-black leading-snug">
        {i < 0 ? '🌙' : line ? t.ritualLines[line] : t.ritualLines.everyoneOpen}
      </Card>
      <div className="mt-4 flex justify-center gap-1">
        {lines.map((l, k) => (
          <span key={l + k} className={`h-1.5 w-6 rounded-full ${k <= i ? 'bg-sky' : 'bg-night-600'}`} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {[3, 4, 6, 8].map((s) => (
          <Chip key={s} active={pause === s} onClick={() => setPause(s)}>
            {text.t.secs(s)}
          </Chip>
        ))}
        <Chip active={aloud} onClick={() => setAloud(!aloud)}>
          🔊
        </Chip>
      </div>
      <div className="mt-8 flex gap-3">
        {i < 0 ? (
          <Button className="h-14 flex-1 text-lg" onClick={() => setI(0)}>
            ▶ {t.start}
          </Button>
        ) : (
          <>
            <Button tone="ghost" className="h-14" onClick={() => setI(Math.max(0, i - 1))}>
              ‹
            </Button>
            <Button className="h-14 flex-1 text-lg" onClick={i >= lines.length ? onDone : () => setI(i + 1)}>
              {i >= lines.length ? t.start : t.next}
            </Button>
          </>
        )}
      </div>
    </Screen>
  );
}

function Board({ saved, setSaved, text, onExit }: { saved: Saved; setSaved: (s: Saved) => void; text: QuestText; onExit: () => void }) {
  const { setup, steps, redo } = saved;
  const replay = useMemo(() => quest.replayQuest(setup, steps), [setup, steps]);
  const state = replay.states.at(-1)!;
  const n = setup.players.length;
  const { t, terms } = text;
  const nameOf = (id: string) => setup.players.find((p) => p.id === id)?.name ?? '?';
  const over = state.phase === 'over';
  const statsId = saved.id ?? `quest-${setup.players[0]?.id}`;
  useReportGame(over ? { family: 'quest', id: statsId, skin: saved.skin, startedAt: saved.startedAt ?? null, setup, steps } : null, over ? `${statsId}:${steps.length}` : '');

  const commit = (step: quest.QuestStep) => {
    if (quest.questStepProblem(setup, state, step)) return;
    setSaved({ ...saved, steps: [...steps, step], redo: [] });
  };
  const back = () => steps.length && setSaved({ ...saved, steps: steps.slice(0, -1), redo: [steps.at(-1)!, ...redo] });
  const forward = () => {
    const next = redo[0];
    if (next && !quest.questStepProblem(setup, state, next)) setSaved({ ...saved, steps: [...steps, next], redo: redo.slice(1) });
  };

  return (
    <Screen className={text.font}>
      <header className="mb-3 flex items-center gap-2">
        <button className="h-10 w-10 rounded-full bg-night-700" aria-label="Home" onClick={() => confirm(`${t.endGame}?`) && onExit()}>
          ⌂
        </button>
        <div className="flex-1 text-xl font-black">
          {terms.chapter} {text.num(state.chapter)}
        </div>
        <Button tone="ghost" className="min-h-10 px-3 text-sm" disabled={!steps.length} onClick={back}>
          ‹ {t.back}
        </Button>
        <Button tone="ghost" className="min-h-10 px-3 text-sm" disabled={!redo.length} onClick={forward}>
          {t.next} ›
        </Button>
        <FullscreenButton />
      </header>

      <Card className="!p-4">
        <ChapterTrack
          teams={quest.tableFor(n).teams}
          doubleFail={[1, 2, 3, 4, 5].map((c) => quest.failsNeeded(n, c) === 2)}
          results={state.results}
          chapter={state.chapter}
          text={text}
        />
        <div className="mt-3 flex items-center justify-between text-sm font-bold">
          <RejectionTrack count={state.rejections} text={text} />
          <span>
            👑 {nameOf(state.commander)}
            {state.spy && ` · 🕵️ ${nameOf(state.spy)}`}
          </span>
        </div>
      </Card>

      <div className="mt-3 flex flex-1 flex-col gap-3" key={steps.length}>
        {state.phase === 'propose' && <Propose setup={setup} state={state} text={text} onCommit={commit} />}
        {state.phase === 'vote' && <VoteEntry setup={setup} state={state} text={text} onCommit={commit} />}
        {state.phase === 'chapter' && <ChapterCards setup={setup} state={state} text={text} onCommit={commit} />}
        {state.phase === 'spy' && <SpyCheck setup={setup} state={state} text={text} onCommit={commit} />}
        {state.phase === 'guess' && <Guess setup={setup} text={text} onCommit={commit} />}
        {state.phase === 'over' && <OverLocal setup={setup} state={state} text={text} onExit={onExit} />}
        {state.votes.length > 0 && state.phase !== 'over' && <LastVote setup={setup} state={state} text={text} />}
      </div>
    </Screen>
  );
}

interface StepProps {
  setup: quest.QuestSetup;
  state: quest.QuestState;
  text: QuestText;
  onCommit: (step: quest.QuestStep) => void;
}

function Propose({ setup, state, text, onCommit }: StepProps) {
  const size = quest.teamSize(setup.players.length, state.chapter);
  const [team, setTeam] = useState<string[]>([]);
  return (
    <Card>
      <div className="text-xl font-black">{text.t.proposing(setup.players.find((p) => p.id === state.commander)!.name, size)}</div>
      <div className="mt-3">
        <SeatList
          players={setup.players}
          commander={state.commander}
          spy={state.spy}
          pastSpies={state.pastSpies}
          selected={team}
          onToggle={(id) => setTeam((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < size ? [...cur, id] : cur))}
          text={text}
        />
      </div>
      <Button className="mt-4 h-14 w-full text-lg" disabled={team.length !== size} onClick={() => onCommit({ kind: 'propose', team })}>
        {text.t.proposeButton} ({text.num(team.length)}/{text.num(size)})
      </Button>
    </Card>
  );
}

function VoteEntry({ setup, state, text, onCommit }: StepProps) {
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const all = setup.players.every((p) => votes[p.id] !== undefined);
  const set = (v: boolean) => setVotes(Object.fromEntries(setup.players.map((p) => [p.id, v])));
  return (
    <Card>
      <div className="text-xl font-black">{text.t.voteOnTeam}</div>
      <p className="text-sm text-mist">
        ⚔️ {(state.team ?? []).map((id) => setup.players.find((p) => p.id === id)!.name).join(', ')}
      </p>
      <div className="mt-3 flex gap-2">
        <Chip onClick={() => set(true)}>{text.t.everyone} 👍</Chip>
        <Chip onClick={() => set(false)}>{text.t.everyone} 👎</Chip>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {setup.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-night-800 px-3 py-1.5">
            <span className="flex-1 font-bold">{p.name}</span>
            <button className={`h-10 w-14 rounded-xl font-black ${votes[p.id] === true ? 'bg-village text-night-950' : 'bg-night-600'}`} onClick={() => setVotes({ ...votes, [p.id]: true })}>
              👍
            </button>
            <button className={`h-10 w-14 rounded-xl font-black ${votes[p.id] === false ? 'bg-mafia text-white' : 'bg-night-600'}`} onClick={() => setVotes({ ...votes, [p.id]: false })}>
              👎
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-4 h-14 w-full text-lg" disabled={!all} onClick={() => onCommit({ kind: 'vote', votes })}>
        {text.t.done}
      </Button>
    </Card>
  );
}

function ChapterCards({ setup, state, text, onCommit }: StepProps) {
  const team = state.team ?? [];
  const [plays, setPlays] = useState<Record<string, 'success' | 'betray'>>({});
  const [held, setHeld] = useState(false);
  const { t, terms } = text;
  const next = team.find((id) => !plays[id]);

  if (next) {
    const name = setup.players.find((p) => p.id === next)!.name;
    const good = quest.isGood(setup, next);
    return (
      <Card className="text-center">
        <h2 className="text-2xl font-black">{t.passTo(name)}</h2>
        <p className="text-mist">{t.onlyThem(name)}</p>
        <HoldButton onHold={setHeld} className="mt-4 w-full touch-none rounded-2xl bg-night-800 py-4 font-extrabold">
          {held ? `${cardName(setup.cards[next], text.lang)} · ${terms.sides[good ? 'good' : 'evil']}` : t.playCard}
        </HoldButton>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setPlays({ ...plays, [next]: 'success' })} className="min-h-24 rounded-2xl bg-village/15 text-lg font-black text-village ring-2 ring-village/50 active:scale-95">
            🛡️ {terms.success}
          </button>
          <button
            onClick={() => !good && setPlays({ ...plays, [next]: 'betray' })}
            className={`min-h-24 rounded-2xl bg-mafia/15 text-lg font-black text-mafia ring-2 ring-mafia/50 active:scale-95 ${good ? 'cursor-not-allowed' : ''}`}
          >
            🗡️ {terms.betrayal}
          </button>
        </div>
        {good && held && <p className="mt-2 text-xs text-mist">{t.goodOnlySuccess}</p>}
      </Card>
    );
  }

  return <ChapterReveal plays={plays} chapter={state.chapter} text={text} onDone={() => onCommit({ kind: 'chapter', plays })} />;
}

function ChapterReveal({ plays, chapter, text, onDone }: { plays: Record<string, 'success' | 'betray'>; chapter: number; text: QuestText; onDone: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const { t, terms } = text;
  const order = useMemo(() => Object.values(plays).sort(() => Math.random() - 0.5), [plays]);
  return (
    <Card className="text-center">
      {!revealed ? (
        <Button className="h-14 w-full text-lg" onClick={() => setRevealed(true)}>
          🃏 {terms.chapter} {text.num(chapter)}
        </Button>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {order.map((c, i) => (
              <div key={i} className={`grid h-20 w-14 place-items-center rounded-xl text-2xl animate-flip ${c === 'success' ? 'bg-village/25' : 'bg-mafia/30'}`} style={{ animationDelay: `${i * 450}ms` }}>
                {c === 'success' ? '🛡️' : '🗡️'}
              </div>
            ))}
          </div>
          <Button className="mt-4 h-14 w-full text-lg" onClick={onDone}>
            {t.next}
          </Button>
        </>
      )}
    </Card>
  );
}

function SpyCheck({ setup, state, text, onCommit }: StepProps) {
  const [target, setTarget] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const spyName = setup.players.find((p) => p.id === state.spy)!.name;
  const { t, terms } = text;
  return (
    <Card>
      <h2 className="text-2xl font-black">🕵️ {t.passTo(spyName)}</h2>
      <p className="text-mist">{t.spyPick}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {setup.players
          .filter((p) => p.id !== state.spy && !state.pastSpies.includes(p.id))
          .map((p) => (
            <Chip key={p.id} active={target === p.id} onClick={() => setTarget(p.id)}>
              {p.name}
            </Chip>
          ))}
      </div>
      {target && (
        <>
          <HoldButton onHold={setHeld} className="mt-4 w-full touch-none rounded-2xl bg-night-800 py-4 font-extrabold">
            {held ? t.spyResult(setup.players.find((p) => p.id === target)!.name, terms.sides[quest.isGood(setup, target) ? 'good' : 'evil']) : t.holdToSee}
          </HoldButton>
          <Button className="mt-3 h-14 w-full text-lg" onClick={() => onCommit({ kind: 'spy', target })}>
            {t.done}
          </Button>
        </>
      )}
    </Card>
  );
}

function Guess({ setup, text, onCommit }: Omit<StepProps, 'state'>) {
  const [target, setTarget] = useState<string | null>(null);
  const { t, terms } = text;
  return (
    <Card>
      <h2 className="text-2xl font-black text-mafia">{t.lastChance(terms.guesser)}</h2>
      <p className="text-mist">{t.guessPrompt}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {setup.players.map((p) => (
          <Chip key={p.id} active={target === p.id} onClick={() => setTarget(p.id)}>
            {p.name}
          </Chip>
        ))}
      </div>
      <Button tone="danger" className="mt-4 h-14 w-full text-lg" disabled={!target || !quest.isGood(setup, target)} onClick={() => target && onCommit({ kind: 'guess', target })}>
        {t.done}
      </Button>
    </Card>
  );
}

function LastVote({ setup, state, text }: { setup: quest.QuestSetup; state: quest.QuestState; text: QuestText }) {
  const last = state.votes.at(-1)!;
  if (setup.rules.anonymousVotes) return null;
  return (
    <p className="text-center text-xs text-mist">
      {last.approved ? text.t.teamApproved : text.t.teamRejected}:{' '}
      {setup.players.map((p) => `${last.votes[p.id] ? '👍' : '👎'}${p.name}`).join(' ')}
    </p>
  );
}

function OverLocal({ setup, state, text, onExit }: { setup: quest.QuestSetup; state: quest.QuestState; text: QuestText; onExit: () => void }) {
  const { t, terms } = text;
  const guess = state.guess ? setup.players.find((p) => p.id === state.guess)!.name : '';
  return (
    <div className="flex flex-col gap-3 animate-rise">
      <div className="text-center">
        <h1 className="text-4xl font-black">
          {terms.sides[state.winner!]} {t.wins[state.winner!]}
        </h1>
        {state.reason && <p className="mt-1 text-mist">{t.reason[state.reason](terms.guesser, guess)}</p>}
      </div>
      <Card>
        <ul className="grid grid-cols-2 gap-2">
          {setup.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-night-800 p-2">
              <QuestArt card={setup.cards[p.id]!} className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <div className="line-clamp-2 break-words text-sm font-extrabold leading-tight">{p.name}</div>
                <div className={`line-clamp-2 break-words text-xs font-bold leading-tight ${quest.isGood(setup, p.id) ? 'text-village' : 'text-mafia'}`}>{cardName(setup.cards[p.id], text.lang)}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Button className="h-14 text-lg" onClick={onExit}>
        ↺ {t.start}
      </Button>
    </div>
  );
}
