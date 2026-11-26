import { useEffect, useMemo, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { teamOf, type CardView, type Command, type RoomView } from '@sus/engine';
import { emptyDraft, type Draft } from '../App';
import { CardBack, RoleArt } from '../art/RoleArt';
import { Button, Card, Chip, HoldButton, Screen, Sheet, TEAM_TEXT } from '../components/ui';
import { unlockAudio, useCues } from '../lib/audio';
import { promptName } from '../lib/describe';
import { formatClock, formatTime, useRoom, useSecondsLeft } from '../lib/room';
import { QuotaNotice, StorageBanner } from '../components/Quota';
import { CONNECT_TV_EN, ConnectTv } from '../components/ConnectTv';
import { useWakeLock } from '../lib/wakeLock';
import { SKINS, type Skin, type SkinId } from '../skins';
import { Roles, RulesStep } from './Setup';
import { AnnouncementCard } from '../components/Announcement';

type Send = (cmd: Command) => void;

export function Play({ code }: { code: string }) {
  const room = useRoom(code, 'player');
  const { view, status } = room;
  const skin = SKINS[(view?.settings.skin as SkinId) ?? 'mafia'];
  const [sound, setSound] = useState(false);
  useWakeLock();
  useCues(view?.cue ?? null, skin, {
    enabled: sound && !!view?.you?.isHost && !view.tvConnected,
    narrated: view?.settings.nightStyle === 'narrated',
  });

  if (status === 'missing') {
    return (
      <Screen className="items-center justify-center text-center">
        <h1 className="text-3xl font-black">Room {code} not found</h1>
        <p className="mt-2 text-mist">It may have expired. Ask the host for the code again.</p>
        <Button className="mt-6" onClick={() => location.assign('/')}>
          Home
        </Button>
      </Screen>
    );
  }
  if (status === 'quota') {
    return (
      <QuotaNotice
        title="Phone games are paused"
        body={`Today's free server allowance is used up. Phone games work again at ${formatClock(room.quotaResetAt ?? Date.now())}. Meanwhile you can still play on one phone.`}
        action="Play on one phone"
        onAction={() => location.assign('/')}
      />
    );
  }
  if (status === 'needJoin') return <JoinForm code={code} onJoin={room.join} onRejoin={room.rejoin} error={room.error} />;
  if (!view || !view.you) {
    return (
      <Screen className="items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky border-t-transparent" />
      </Screen>
    );
  }

  const you = view.you;
  const night = view.night;
  const blackout = night?.style === 'narrated' && night.stage !== 'ready' && !night.awake && you.alive;

  return (
    <Screen className={blackout ? 'bg-black' : ''}>
      {blackout ? null : (
        <Header view={view} send={room.send} sound={sound} setSound={setSound} />
      )}
      <div className="flex flex-1 flex-col">
        {room.storageFullUntil && !blackout && <StorageBanner>{`The server can't save games until ${formatClock(room.storageFullUntil)}. This game keeps going, but if every phone drops it may be lost.`}</StorageBanner>}
        {view.phase === 'lobby' && <Lobby view={view} send={room.send} />}
        {view.phase === 'reveal' && <RevealRole view={view} skin={skin} send={room.send} />}
        {view.phase === 'night' && <Night view={view} skin={skin} send={room.send} />}
        {view.phase === 'day' && <Day view={view} skin={skin} send={room.send} clockOffset={room.clockOffset} />}
        {view.phase === 'over' && <Over view={view} skin={skin} send={room.send} />}
      </div>
      {!blackout && <Announcements view={view} skin={skin} send={room.send} />}
      {room.error && (
        <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-2xl bg-mafia px-4 py-3 text-center font-bold text-white animate-rise">
          {room.error}
        </div>
      )}
    </Screen>
  );
}

function JoinForm({
  code,
  onJoin,
  onRejoin,
  error,
}: {
  code: string;
  onJoin: (name: string) => void;
  onRejoin: (code: string) => void;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [rejoin, setRejoin] = useState(false);
  return (
    <Screen className="justify-center">
      <div className="text-center animate-rise">
        <RoleArt role="villager" className="mx-auto h-28 w-28 animate-float" />
        <p className="mt-2 text-sm font-bold uppercase tracking-widest text-haze">Room</p>
        <h1 className="text-5xl font-black tracking-widest">{code}</h1>
      </div>
      <form
        className="mt-8 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) (rejoin ? onRejoin : onJoin)(name.trim());
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={rejoin ? 'Rejoin code from the host' : 'Your name'}
          maxLength={20}
          className="min-h-14 rounded-2xl bg-night-700 px-5 text-lg font-bold text-ink outline-none ring-1 ring-white/10 placeholder:text-haze focus:ring-sky"
        />
        <Button type="submit" className="h-14 text-lg" disabled={!name.trim()}>
          {rejoin ? 'Rejoin' : 'Join'}
        </Button>
        <button type="button" className="text-sm font-bold text-sky" onClick={() => setRejoin(!rejoin)}>
          {rejoin ? 'Join as a new player instead' : 'Already in this game? Use a rejoin code'}
        </button>
        {error && <p className="text-center font-bold text-mafia">{error}</p>}
      </form>
    </Screen>
  );
}

function Header({ view, send, sound, setSound }: { view: RoomView; send: Send; sound: boolean; setSound: (s: boolean) => void }) {
  const [menu, setMenu] = useState(false);
  const you = view.you!;
  const phase =
    view.phase === 'night' ? `🌙 Night ${view.night?.number}` :
    view.phase === 'day' ? `☀️ Day ${view.day?.number}` :
    view.phase === 'lobby' ? 'Lobby' :
    view.phase === 'reveal' ? 'Your role' : 'Game over';

  return (
    <header className="mb-4 flex items-center gap-2">
      <div className="flex-1">
        <div className="text-lg font-black">{phase}</div>
        <div className="text-xs font-bold text-mist">
          {you.name}
          {you.isHost && ' · host'} · room {view.code}
          {!you.alive && ' · 👻 out'}
        </div>
      </div>
      {you.isHost && !view.tvConnected && (
        <button
          className={`h-10 rounded-full px-3 text-sm font-bold ${sound ? 'bg-sky text-night-950' : 'bg-night-700'}`}
          onClick={() => setSound(!sound && unlockAudio() !== undefined)}
          aria-pressed={sound}
        >
          {sound ? '🔊' : '🔇'}
        </button>
      )}
      <button className="h-10 rounded-full bg-night-700 px-4 text-sm font-bold" onClick={() => setMenu(true)}>
        {you.isHost ? 'Host' : 'Menu'}
      </button>
      <MenuSheet open={menu} onClose={() => setMenu(false)} view={view} send={send} />
    </header>
  );
}

function MenuSheet({ open, onClose, view, send }: { open: boolean; onClose: () => void; view: RoomView; send: Send }) {
  const you = view.you!;
  const [leaving, setLeaving] = useState(false);
  const [successor, setSuccessor] = useState<string | null>(null);
  const admin = (action: Extract<Command, { type: 'admin' }>['action']) => send({ type: 'admin', action });
  const others = view.players.filter((p) => p.id !== you.id && !p.absent);
  const inGame = view.phase !== 'lobby' && view.phase !== 'over';

  return (
    <Sheet open={open} onClose={onClose} title={you.isHost ? 'Host controls' : 'Menu'}>
      {you.isHost && inGame && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          {view.paused ? (
            <Button tone="ghost" onClick={() => admin({ kind: 'resume' })}>▶ Resume</Button>
          ) : (
            <Button tone="ghost" disabled={!view.deadline} onClick={() => admin({ kind: 'pause' })}>⏸ Pause</Button>
          )}
          <Button tone="ghost" onClick={() => admin({ kind: 'extend' })}>+30 seconds</Button>
          <Button tone="ghost" className="col-span-2" onClick={() => admin({ kind: 'skip' })}>
            Skip waiting (missing answers count as none)
          </Button>
        </div>
      )}

      {you.isHost && view.host && view.host.absent.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-haze">Left the game</div>
          {view.host.absent.map((p) => (
            <div key={p.id} className="mb-2 flex items-center gap-2 rounded-2xl bg-night-700/60 p-3">
              <span className="flex-1 font-bold">{p.name}</span>
              <Button tone="ghost" className="min-h-9 text-sm" onClick={() => admin({ kind: 'rejoinCode', player: p.id })}>
                Rejoin code
              </Button>
              <Button tone="danger" className="min-h-9 text-sm" onClick={() => admin({ kind: 'remove', player: p.id })}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {you.isHost && view.host && view.host.rejoinCodes.length > 0 && (
        <div className="mb-5 rounded-2xl bg-night-700/60 p-3">
          <div className="mb-1 text-xs font-black uppercase tracking-widest text-haze">Rejoin codes</div>
          {view.host.rejoinCodes.map((c) => (
            <div key={c.code} className="flex justify-between font-bold">
              <span>{c.name}</span>
              <span className="tracking-widest text-sky">{c.code}</span>
            </div>
          ))}
          <p className="mt-1 text-xs text-mist">Enter it on the new phone under "Use a rejoin code".</p>
        </div>
      )}

      {you.isHost && (
        <div className="mb-5">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-haze">Make someone else host</div>
          <div className="flex flex-wrap gap-1.5">
            {others.map((p) => (
              <Chip key={p.id} onClick={() => admin({ kind: 'transferHost', player: p.id })}>
                {p.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {you.isHost && view.phase === 'lobby' && (
        <p className="mb-5 text-sm text-mist">
          TV screen: open <span className="font-bold text-ink">{location.host}/tv/{view.code}</span> on any big screen.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {you.isHost && inGame && (
          <Button tone="ghost" onClick={() => confirm('End the game for everyone?') && admin({ kind: 'end' })}>
            End game
          </Button>
        )}
        {!leaving ? (
          <Button tone="danger" onClick={() => setLeaving(true)}>
            Leave room
          </Button>
        ) : (
          <div className="rounded-2xl bg-night-700/60 p-4">
            {you.isHost && others.length > 0 && (
              <>
                <p className="mb-2 text-sm text-mist">Who should be the new host?</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {others.map((p) => (
                    <Chip key={p.id} active={successor === p.id} onClick={() => setSuccessor(p.id)}>
                      {p.name}
                    </Chip>
                  ))}
                </div>
              </>
            )}
            <Button
              tone="danger"
              className="w-full"
              onClick={() => {
                send({ type: 'leave', successor: successor ?? undefined });
                try {
                  localStorage.removeItem(`sus.token.${view.code}`);
                } catch {
                  // Nothing to clean up.
                }
                setTimeout(() => location.assign('/'), 150);
              }}
            >
              Leave{view.phase !== 'lobby' ? ` (you'll count as absent)` : ''}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Lobby({ view, send }: { view: RoomView; send: Send }) {
  const you = view.you!;
  const [tab, setTab] = useState<'roles' | 'rules' | 'game'>('roles');
  const [qr, setQr] = useState('');
  const joinUrl = `${location.origin}/play/${view.code}`;
  const total = Object.values(view.settings.counts).reduce((a, b) => a + (b ?? 0), 0);
  const skin = SKINS[view.settings.skin as SkinId];

  useEffect(() => {
    QRCode.toString(joinUrl, { type: 'svg', margin: 0, color: { dark: '#eef1ff', light: '#00000000' } }).then(setQr);
  }, [joinUrl]);

  const draft: Draft = {
    ...emptyDraft,
    names: view.players.map((p) => p.name),
    counts: view.settings.counts,
    rules: view.settings.rules,
    preset: view.settings.preset,
    skin: view.settings.skin as SkinId,
  };
  const patch = (p: Partial<Draft>) =>
    send({
      type: 'configure',
      settings: {
        ...(p.counts && { counts: p.counts }),
        ...(p.rules && { rules: p.rules }),
        ...(p.preset && { preset: p.preset }),
        ...(p.skin && { skin: p.skin }),
      },
    });

  const startProblem =
    view.players.length < 5 ? 'Need at least 5 players' :
    total !== view.players.length ? `Roles (${total}) must match players (${view.players.length})` :
    null;

  return (
    <div className="flex flex-col gap-4 animate-rise">
      <Card className="flex items-center gap-4">
        <div className="h-28 w-28 shrink-0 rounded-2xl bg-night-800 p-2" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-haze">Join with code</div>
          <div className="text-4xl font-black tracking-widest">{view.code}</div>
          <div className="truncate text-xs text-mist">{location.host}/play/{view.code}</div>
        </div>
      </Card>

      {you.isHost && !view.tvConnected && <ConnectTv room={view.code} text={CONNECT_TV_EN} />}

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-haze">Players</span>
          <span className="text-sm font-bold text-mist">{view.players.length}</span>
        </div>
        <ul className="flex flex-wrap gap-2">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-night-800 py-1.5 pl-3 pr-2 text-sm font-bold">
              <span className={`h-2 w-2 rounded-full ${p.connected ? 'bg-village' : 'bg-haze'}`} />
              {p.name}
              {p.isHost && ' 👑'}
              {you.isHost && p.id !== you.id && (
                <button aria-label={`Remove ${p.name}`} className="ml-1 text-mafia" onClick={() => send({ type: 'admin', action: { kind: 'kick', player: p.id } })}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {you.isHost ? (
        <>
          <div className="flex gap-1 rounded-full bg-night-800 p-1">
            {(['roles', 'rules', 'game'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full py-2 text-sm font-extrabold capitalize ${tab === t ? 'bg-sky text-night-950' : 'text-mist'}`}>
                {t}
              </button>
            ))}
          </div>
          {tab === 'roles' && <Roles draft={draft} patch={patch} />}
          {tab === 'rules' && <RulesStep draft={draft} patch={patch} />}
          {tab === 'game' && <GameSettings view={view} send={send} />}
          <div className="sticky bottom-0 bg-gradient-to-t from-night-900 via-night-900/95 to-transparent pt-4">
            <Button className="h-14 w-full text-lg" disabled={!!startProblem} onClick={() => send({ type: 'start' })}>
              {startProblem ?? 'Deal roles'}
            </Button>
          </div>
        </>
      ) : (
        <Card className="text-center">
          <p className="font-bold">Waiting for {view.hostName} to start…</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {Object.entries(view.settings.counts)
              .filter(([, n]) => n)
              .map(([role, n]) => (
                <span key={role} className="rounded-full bg-night-800 px-3 py-1 text-xs font-bold text-mist">
                  {n}× {skin.roles[role as keyof Skin['roles']].name}
                </span>
              ))}
          </div>
          <p className="mt-3 text-xs text-haze">
            {view.settings.nightStyle === 'narrated' ? 'Narrated night: eyes closed, roles called one by one.' : 'Quick tap night: everyone answers two questions.'}
          </p>
        </Card>
      )}
    </div>
  );
}

function GameSettings({ view, send }: { view: RoomView; send: Send }) {
  const s = view.settings;
  const set = (settings: Partial<RoomView['settings']>) => send({ type: 'configure', settings });
  return (
    <div className="flex flex-col gap-2">
      <Setting label="Night style" hint={s.nightStyle === 'quick' ? 'Everyone answers two questions on identical screens. Fast, no narrator.' : 'Eyes closed; the TV or host phone calls each role in turn.'}>
        <Chip active={s.nightStyle === 'quick'} onClick={() => set({ nightStyle: 'quick' })}>Quick tap</Chip>
        <Chip active={s.nightStyle === 'narrated'} onClick={() => set({ nightStyle: 'narrated' })}>Narrated</Chip>
      </Setting>
      {s.nightStyle === 'narrated' && (
        <Setting label="Back-to-sleep timer">
          {[3, 5, 7, 10].map((n) => (
            <Chip key={n} active={s.sleepSeconds === n} onClick={() => set({ sleepSeconds: n })}>
              {n}s
            </Chip>
          ))}
        </Setting>
      )}
      <Setting label="Discussion time">
        {[60, 120, 180, 300, 600].map((n) => (
          <Chip key={n} active={s.discussionSeconds === n} onClick={() => set({ discussionSeconds: n })}>
            {n / 60} min
          </Chip>
        ))}
      </Setting>
    </div>
  );
}

function Setting({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-night-700/60 p-4 ring-1 ring-white/5">
      <div className="font-extrabold">{label}</div>
      {hint && <p className="mt-0.5 text-xs text-mist">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function RevealRole({ view, skin, send }: { view: RoomView; skin: Skin; send: Send }) {
  const you = view.you!;
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(false);
  const role = you.role!;
  const team = teamOf(role);
  const skinId = view.settings.skin as SkinId;
  const waiting = view.players.filter((p) => !p.absent).length;

  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <HoldButton
        onHold={(h) => {
          setHeld(h);
          if (h) setSeen(true);
        }}
        className="mt-2 w-full max-w-[16rem] touch-none select-none"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2rem] ring-1 ring-white/10">
          {held ? (
            <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-night-600 to-night-800 p-5">
              <RoleArt role={role} skin={skinId} className="h-32 w-32" />
              <div className={`mt-2 text-xs font-black uppercase tracking-widest ${TEAM_TEXT[team]}`}>{skin.teams[team]}</div>
              <div className="text-2xl font-black">{skin.roles[role].name}</div>
              <p className="mt-2 text-sm text-mist">{skin.roles[role].blurb}</p>
              {you.teammates.length > 0 && (
                <p className="mt-3 text-sm font-bold text-mafia">
                  Your team: {you.teammates.map((t) => `${t.name} (${skin.roles[t.role].name})`).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <div className="relative h-full">
              <CardBack className="h-full w-full" />
              <span className="absolute inset-x-0 bottom-6 text-sm font-extrabold">Hold to see your role</span>
            </div>
          )}
        </div>
      </HoldButton>
      {you.seenRole ? (
        <p className="mt-6 font-bold text-mist">Waiting for everyone to check their role ({waiting} players)…</p>
      ) : (
        <Button className="mt-6 h-14 w-full text-lg" disabled={!seen || held} onClick={() => send({ type: 'seenRole' })}>
          Got it
        </Button>
      )}
    </div>
  );
}

function cardTitle(card: CardView, skin: Skin) {
  if (card.kind === 'predictDeath') return 'Who do you think dies tonight?';
  if (card.kind === 'predictRole') return `Who do you think is the ${skin.roles[card.role!].name}?`;
  const titles: Record<string, string> = {
    mafia: 'Who should be eliminated?',
    roleblocker: 'Whose ability do you block tonight?',
    serialKiller: 'Who do you kill tonight?',
    vigilante: 'Do you take a shot tonight?',
    bodyguard: 'Who do you guard tonight?',
    doctor: 'Who do you protect tonight?',
    lover: 'Who do you spend the night with?',
    detective: 'Who do you check tonight?',
  };
  return titles[card.key!] ?? 'Choose a player';
}

function NightCardPanel({ card, view, skin, send }: { card: CardView; view: RoomView; skin: Skin; send: Send }) {
  const votesFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of view.night?.mafiaVotes ?? []) if (v.target) map.set(v.target, [...(map.get(v.target) ?? []), v.voter]);
    return map;
  }, [view.night?.mafiaVotes]);
  const mafia = card.kind === 'action' && card.key === 'mafia';
  const locked = !mafia && card.target !== undefined;

  return (
    <Card className="animate-rise">
      <div className="text-xl font-black leading-tight">{cardTitle(card, skin)}</div>
      {mafia && view.you!.teammates.length > 0 && (
        <p className="mt-1 text-xs text-mist">
          {view.you!.teammates.some((t) => t.role === 'godfather') || view.you!.role === 'godfather'
            ? `The ${skin.roles.godfather.name} has the final say.`
            : 'Most votes wins; a tie is settled at random.'}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {card.options.map((o) => {
          const voters = votesFor.get(o.name) ?? [];
          return (
            <button
              key={o.id}
              disabled={!!o.disabled || locked}
              onClick={() => send({ type: 'pick', card: card.index, target: o.id })}
              className={`min-h-14 rounded-2xl px-3 text-left font-extrabold ring-1 transition active:scale-95 disabled:opacity-30 ${
                card.target === o.id ? 'bg-sky text-night-950 ring-sky' : 'bg-night-800 ring-white/5'
              }`}
            >
              {o.name}
              {mafia && voters.length > 0 && <span className="block text-[11px] font-bold opacity-80">← {voters.join(', ')}</span>}
              {o.disabled && <span className="block text-[11px] font-bold">{o.disabled}</span>}
            </button>
          );
        })}
        <button
          disabled={locked}
          onClick={() => send({ type: 'pick', card: card.index, target: null })}
          className={`col-span-2 min-h-12 rounded-2xl font-extrabold ring-1 ${card.target === null ? 'bg-sky text-night-950 ring-sky' : 'bg-night-800 text-mist ring-white/5'}`}
        >
          {card.kind === 'action' ? 'Nobody' : 'Skip'}
        </button>
      </div>
      {card.result && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-center text-lg font-black ${card.result === 'mafia' ? 'bg-mafia/15 text-mafia' : 'bg-village/15 text-village'}`}>
          {card.result === 'mafia' ? `👎 ${skin.teams.mafia}` : `👍 Not ${skin.teams.mafia}`}
        </div>
      )}
    </Card>
  );
}

function Night({ view, skin, send }: { view: RoomView; skin: Skin; send: Send }) {
  const you = view.you!;
  const night = view.night!;

  if (!you.alive) return <Ghost skin={skin} text="You're out. Keep your eyes closed at night." />;

  if (night.style === 'quick') {
    const next = night.cards.find((c) => c.target === undefined);
    if (next) {
      return (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm font-bold text-haze">
            {night.cards.indexOf(next) + 1} of {night.cards.length}
          </p>
          <NightCardPanel key={next.index} card={next} view={view} skin={skin} send={send} />
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-6xl animate-float">🌙</div>
        <h2 className="mt-4 text-2xl font-black">The night goes on…</h2>
        <p className="mt-1 text-mist">Keep your phone to yourself.</p>
        <div className="mt-6 w-full space-y-2">
          {night.cards.map((c) => (
            <div key={c.index} className="rounded-2xl bg-night-800 px-4 py-3 text-left text-sm">
              <div className="font-bold text-mist">{cardTitle(c, skin)}</div>
              <div className="font-extrabold">
                {c.result ? (c.result === 'mafia' ? `👎 ${skin.teams.mafia}` : `👍 Not ${skin.teams.mafia}`) : 'Locked in 🔒'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (night.stage === 'ready') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-6xl">🌙</div>
        <h2 className="mt-4 text-2xl font-black">Night is coming</h2>
        <p className="mt-1 text-mist">When the narrator says so, close your eyes. Your phone will light up if it's your turn.</p>
        {night.needReady ? (
          <Button className="mt-8 h-14 w-full text-lg" onClick={() => send({ type: 'ready' })}>
            I'm ready
          </Button>
        ) : (
          <p className="mt-8 font-bold text-mist">Waiting for everyone ({night.readyCount} ready)…</p>
        )}
      </div>
    );
  }

  if (!night.awake) {
    return <div className="flex flex-1 items-center justify-center text-sm text-white/10">eyes closed</div>;
  }

  const card = night.cards[0];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm font-black uppercase tracking-widest text-sun">
        {night.calling ? `${promptName(skin, night.calling)}, wake up` : 'Your turn'}
      </p>
      {card ? (
        <NightCardPanel card={card} view={view} skin={skin} send={send} />
      ) : (
        <Card className="text-center text-mist">Nothing to do tonight. Wait a moment, then close your eyes.</Card>
      )}
      {night.calling === 'mafia' && <MafiaChat view={view} send={send} />}
      {card && (
        <Button className="h-14 text-lg" disabled={card.target === undefined || night.youDone} onClick={() => send({ type: 'done' })}>
          {night.youDone ? 'Waiting for your team…' : 'Done, close my eyes'}
        </Button>
      )}
    </div>
  );
}

const REACTIONS = ['👍 Agreed', '❌ Not them', '🤔 Not sure', '👉 Your call'];

function MafiaChat({ view, send }: { view: RoomView; send: Send }) {
  const [text, setText] = useState('');
  return (
    <Card className="!p-4">
      <div className="max-h-32 space-y-1 overflow-y-auto text-sm">
        {view.night!.chat.map((c, i) => (
          <div key={i}>
            <span className="font-bold text-mafia">{c.from}:</span> {c.text}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REACTIONS.map((r) => (
          <Chip key={r} onClick={() => send({ type: 'chat', text: r })}>
            {r}
          </Chip>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send({ type: 'chat', text: text.trim() });
          setText('');
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="Message your team" className="min-h-10 flex-1 rounded-xl bg-night-800 px-3 text-sm outline-none" />
        <Button className="min-h-10 text-sm">Send</Button>
      </form>
    </Card>
  );
}

function Ghost({ skin, text }: { skin: Skin; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <RoleArt role="villager" skin={skin.id} dead className="h-32 w-32 animate-float" />
      <p className="mt-4 font-bold text-mist">{text}</p>
    </div>
  );
}

function Day({ view, skin, send, clockOffset }: { view: RoomView; skin: Skin; send: Send; clockOffset: number }) {
  const you = view.you!;
  const day = view.day!;
  const left = useSecondsLeft(view.deadline, clockOffset);
  const living = view.players.filter((p) => p.alive);
  const options = day.stage === 'runoff' ? living.filter((p) => day.candidates.includes(p.id)) : living;
  const canVote = you.canVote || you.ghostVote;

  return (
    <div className="flex flex-col gap-3">
      <Card className="text-center">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Alive" value={living.length} />
          <Stat label="Votes" value={day.totalVotes} />
          <Stat label="Needed" value={day.needed ?? 'Most'} highlight />
        </div>
        {day.blockedPartner && <p className="mt-3 text-sm font-bold text-rose">💗 {day.blockedPartner} can't vote today.</p>}
      </Card>

      {day.stage === 'discussion' && (
        <Card className="text-center">
          <div className="text-xs font-black uppercase tracking-widest text-haze">Discuss</div>
          <div className="text-6xl font-black tabular-nums">{left !== null ? formatTime(left) : view.paused ? 'Paused' : '—'}</div>
          <p className="mt-1 text-mist">Talk it out. Voting opens when the timer ends.</p>
          {you.isHost && (
            <Button tone="ghost" className="mt-4" onClick={() => send({ type: 'admin', action: { kind: 'continue' } })}>
              Start the vote now
            </Button>
          )}
        </Card>
      )}

      {you.isMayor && you.alive && !day.mayorRevealed && (day.stage === 'discussion' || day.stage === 'vote') && (
        <Button tone="ghost" onClick={() => confirm(`Reveal yourself as ${skin.roles.mayor.name}? Your vote will count twice.`) && send({ type: 'revealMayor' })}>
          Reveal as {skin.roles.mayor.name}
        </Button>
      )}

      {(day.stage === 'vote' || day.stage === 'runoff') && (
        <Card>
          <div className="text-xl font-black">{day.stage === 'runoff' ? 'Runoff: one of these two' : 'Who should be voted out?'}</div>
          <p className="text-sm text-mist">
            {day.votesCast} of {day.voters} have voted. Votes are revealed together.
          </p>
          {canVote ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {options.map((p) => (
                <button
                  key={p.id}
                  onClick={() => send({ type: 'vote', target: p.id })}
                  className={`min-h-14 rounded-2xl font-extrabold ring-1 transition active:scale-95 ${you.myVote === p.id ? 'bg-mafia text-white ring-mafia' : 'bg-night-800 ring-white/5'}`}
                >
                  {p.name}
                </button>
              ))}
              {you.canVote && (
                <button
                  onClick={() => send({ type: 'vote', target: 'skip' })}
                  className={`col-span-2 min-h-12 rounded-2xl font-extrabold ring-1 ${you.myVote === 'skip' ? 'bg-sky text-night-950 ring-sky' : 'bg-night-800 text-mist ring-white/5'}`}
                >
                  Skip
                </button>
              )}
              {you.ghostVote && <p className="col-span-2 text-center text-xs text-neutral">👻 This uses your one ghost vote.</p>}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-night-800 px-4 py-3 text-center font-bold text-mist">
              {you.alive ? "You can't vote today." : "You're out, so you can't vote."}
            </p>
          )}
        </Card>
      )}

      {day.stage === 'hostPick' && (
        <Card>
          <div className="text-xl font-black">Still tied</div>
          {you.isHost ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {day.candidates.map((id) => (
                <Button key={id} tone="ghost" onClick={() => send({ type: 'admin', action: { kind: 'hostPick', player: id } })}>
                  {view.players.find((p) => p.id === id)?.name}
                </Button>
              ))}
              <Button tone="ghost" className="col-span-2" onClick={() => send({ type: 'admin', action: { kind: 'hostPick', player: null } })}>
                Nobody
              </Button>
            </div>
          ) : (
            <p className="text-mist">The host decides who's out.</p>
          )}
        </Card>
      )}

      {day.tally.length > 0 && (
        <Card>
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-haze">Votes</div>
          {day.tally.map((t) => (
            <div key={t.name} className="flex justify-between font-bold">
              <span>{t.name}</span>
              <span className="tabular-nums">{t.votes}</span>
            </div>
          ))}
          {day.ballots.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3 text-xs">
              {day.ballots.map((b) => (
                <span key={b.voter + (b.ghost ? 'g' : '')} className="rounded-full bg-night-800 px-2.5 py-1 font-bold text-mist">
                  {b.ghost && '👻 '}
                  {b.voter} → {b.target ?? 'skip'}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {day.stage === 'result' && you.isHost && (
        <Button className="h-14 text-lg" onClick={() => send({ type: 'admin', action: { kind: 'continue' } })}>
          Night falls 🌙 {left !== null && <span className="opacity-60">({left})</span>}
        </Button>
      )}
    </div>
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

function Over({ view, skin, send }: { view: RoomView; skin: Skin; send: Send }) {
  const skinId = view.settings.skin as SkinId;
  return (
    <div className="flex flex-col gap-3 animate-rise">
      <div className="text-center">
        <h1 className="text-4xl font-black">{view.endedByHost ? 'Game ended' : skin.wins[view.winner!]}</h1>
      </div>
      {view.stats && (
        <Card className="grid grid-cols-3 gap-2 text-center">
          <Award icon="🔮" label="Oracle" name={view.stats.oracle} />
          <Award icon="🎭" label="Poker face" name={view.stats.pokerFace} />
          <Award icon="👀" label="Most suspected" name={view.stats.mostSuspected} />
        </Card>
      )}
      <Card>
        <ul className="grid grid-cols-2 gap-2">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-night-800 p-2">
              {p.shownRole && <RoleArt role={p.shownRole} skin={skinId} dead={!p.alive} className="h-10 w-10 shrink-0" />}
              <div className="min-w-0">
                <div className="line-clamp-2 break-words text-sm font-extrabold leading-tight">{p.name}</div>
                {p.shownRole && <div className={`line-clamp-2 break-words text-xs font-bold leading-tight ${TEAM_TEXT[teamOf(p.shownRole)]}`}>{skin.roles[p.shownRole].name}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {view.you!.isHost ? (
        <Button className="h-14 text-lg" onClick={() => send({ type: 'admin', action: { kind: 'rematch' } })}>
          Play again with this room
        </Button>
      ) : (
        <p className="text-center text-mist">Waiting for the host…</p>
      )}
    </div>
  );
}

function Award({ icon, label, name }: { icon: string; label: string; name: string | null }) {
  return (
    <div>
      <div className="text-2xl">{icon}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-haze">{label}</div>
      <div className="line-clamp-2 break-words font-extrabold leading-tight">{name ?? '—'}</div>
    </div>
  );
}

function Announcements({ view, skin, send }: { view: RoomView; skin: Skin; send: Send }) {
  const [dismissed, setDismissed] = useState<number | null>(null);
  const a = view.announcement;
  const confirmRemove = view.host?.confirmRemove;
  if (confirmRemove) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/80 p-6 backdrop-blur-sm">
        <Card className="w-full max-w-sm text-center animate-rise">
          <div className="text-xl font-black">Remove {confirmRemove.name}?</div>
          <p className="mt-2 text-mist">This ends the game: {skin.wins[confirmRemove.winner]}.</p>
          <div className="mt-5 flex gap-2">
            <Button tone="ghost" className="flex-1" onClick={() => send({ type: 'admin', action: { kind: 'cancelRemove' } })}>
              Cancel
            </Button>
            <Button tone="danger" className="flex-1" onClick={() => send({ type: 'admin', action: { kind: 'remove', player: confirmRemove.player, confirm: true } })}>
              Remove
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  if (!a || dismissed === a.seq || view.phase === 'lobby') return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-night-950/70 p-6 backdrop-blur-sm" onClick={() => setDismissed(a.seq)}>
      <AnnouncementCard announcement={a} skin={skin} skinId={view.settings.skin as SkinId} />
    </div>
  );
}
