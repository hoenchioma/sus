import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { quest } from '@sus/engine';
import { CardBack } from '../../art/RoleArt';
import { QuestArt } from '../../art/QuestArt';
import { Button, Card, Chip, HoldButton, Screen, Sheet } from '../../components/ui';
import { unlockAudio, useQuestCues } from '../../lib/audio';
import { formatClock, useRoom, useSecondsLeft } from '../../lib/room';
import { QuotaNotice, StorageBanner } from '../../components/Quota';
import { ConnectTv } from '../../components/ConnectTv';
import { GamePicker } from '../../components/GamePicker';
import { useWakeLock } from '../../lib/wakeLock';
import { cardName } from '../../skins/quest';
import { ChapterTrack, CharacterReveal, LangToggle, QuestSettingsPanel, RejectionTrack, SeatList, useQuestText, type QuestText } from './parts';
import { FullscreenButton } from '../../components/FullscreenButton';

type View = quest.QuestRoomView;
type Send = (cmd: quest.QuestCommand) => void;
type SwitchGame = (game: 'mafia' | 'quest') => void;

export function QuestPlay({ code }: { code: string }) {
  const room = useRoom<View, quest.QuestCommand>(code, 'player');
  const { view, status } = room;
  const skin = view?.settings.skin ?? 'polashi';
  const text = useQuestText(skin);
  const [sound, setSound] = useState(false);
  useWakeLock();
  useQuestCues(view?.cue ?? null, { enabled: sound && !!view?.you?.isHost && !view.tvConnected, skin, lang: text.lang, lines: text.t.cues });

  if (status === 'missing') {
    return (
      <Screen className="items-center justify-center text-center">
        <h1 className="text-3xl font-black">{text.t.roomMissing(code)}</h1>
        <Button className="mt-6" onClick={() => location.assign('/')}>
          {text.t.home}
        </Button>
      </Screen>
    );
  }
  if (status === 'quota') {
    return (
      <QuotaNotice
        className={text.font}
        title={text.t.quotaTitle}
        body={text.t.quotaBody(formatClock(room.quotaResetAt ?? Date.now(), text.lang))}
        action={text.t.onePhone}
        onAction={() => location.assign('/quest')}
      />
    );
  }
  if (status === 'needJoin') return <JoinQuest code={code} text={text} onJoin={room.join} onRejoin={room.rejoin} error={room.error} />;
  if (!view?.you) {
    return (
      <Screen className="items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky border-t-transparent" />
      </Screen>
    );
  }

  return (
    <Screen className={text.font}>
      <Header view={view} text={text} send={room.send} sound={sound} setSound={setSound} />
      <div className="flex flex-1 flex-col gap-3">
        {room.storageFullUntil && <StorageBanner>{text.t.quotaBanner(formatClock(room.storageFullUntil, text.lang))}</StorageBanner>}
        {view.phase === 'lobby' && <Lobby view={view} text={text} send={room.send} switchGame={room.switchGame} />}
        {view.phase === 'reveal' && <Reveal view={view} text={text} send={room.send} />}
        {view.phase === 'game' && <Game view={view} text={text} send={room.send} clockOffset={room.clockOffset} />}
        {view.phase === 'over' && <Over view={view} text={text} send={room.send} switchGame={room.switchGame} />}
      </div>
      <QuestAnnouncement view={view} text={text} />
      {room.error && (
        <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-2xl bg-mafia px-4 py-3 text-center font-bold text-white animate-rise">
          {room.error}
        </div>
      )}
    </Screen>
  );
}

function JoinQuest({
  code,
  text,
  onJoin,
  onRejoin,
  error,
}: {
  code: string;
  text: QuestText;
  onJoin: (n: string) => void;
  onRejoin: (c: string) => void;
  error: string | null;
}) {
  const [name, setName] = useState('');
  const [rejoin, setRejoin] = useState(false);
  return (
    <Screen className={`justify-center ${text.font}`}>
      <div className="flex justify-end">
        <LangToggle text={text} skin="polashi" />
      </div>
      <div className="text-center animate-rise">
        <QuestArt card="mirMadan" className="mx-auto h-28 w-28 animate-float" />
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
          placeholder={rejoin ? text.t.rejoinCode : text.t.yourName}
          maxLength={20}
          className="min-h-14 rounded-2xl bg-night-700 px-5 text-lg font-bold text-ink outline-none ring-1 ring-white/10 placeholder:text-haze focus:ring-sky"
        />
        <Button type="submit" className="h-14 text-lg" disabled={!name.trim()}>
          {text.t.join}
        </Button>
        <button type="button" className="text-sm font-bold text-sky" onClick={() => setRejoin(!rejoin)}>
          {rejoin ? text.t.joinNew : text.t.useRejoinCode}
        </button>
        {error && <p className="text-center font-bold text-mafia">{error}</p>}
      </form>
    </Screen>
  );
}

function Header({ view, text, send, sound, setSound }: { view: View; text: QuestText; send: Send; sound: boolean; setSound: (s: boolean) => void }) {
  const [menu, setMenu] = useState(false);
  const you = view.you!;
  const title =
    view.phase === 'game' && view.board ? `${text.terms.chapter} ${text.num(view.board.chapter)}` : view.phase === 'lobby' ? text.terms.game : view.phase === 'reveal' ? text.t.yourSide : text.terms.game;
  return (
    <header className="mb-4 flex items-center gap-2">
      <div className="flex-1">
        <div className="text-lg font-black">{title}</div>
        <div className="text-xs font-bold text-mist">
          {you.name}
          {you.isHost && ' · host'} · {view.code}
        </div>
      </div>
      <LangToggle text={text} skin={view.settings.skin} />
      {you.isHost && !view.tvConnected && (
        <button className={`h-10 rounded-full px-3 text-sm font-bold ${sound ? 'bg-sky text-night-950' : 'bg-night-700'}`} onClick={() => setSound(!sound && unlockAudio() !== undefined)}>
          {sound ? '🔊' : '🔇'}
        </button>
      )}
      <button className="h-10 rounded-full bg-night-700 px-4 text-sm font-bold" onClick={() => setMenu(true)}>
        ☰
      </button>
      <FullscreenButton />
      <Menu open={menu} onClose={() => setMenu(false)} view={view} text={text} send={send} />
    </header>
  );
}

function Menu({ open, onClose, view, text, send }: { open: boolean; onClose: () => void; view: View; text: QuestText; send: Send }) {
  const you = view.you!;
  const { t } = text;
  const admin = (action: quest.QuestAdmin) => send({ type: 'admin', action });
  const others = view.players.filter((p) => p.id !== you.id && !p.absent);
  const [successor, setSuccessor] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title={you.isHost ? t.host : '☰'}>
      <div className={`flex flex-col gap-2 ${text.font}`}>
        {you.isHost && view.phase === 'game' && (
          <div className="grid grid-cols-2 gap-2">
            {view.paused ? <Button tone="ghost" onClick={() => admin({ kind: 'resume' })}>▶ {t.resume}</Button> : <Button tone="ghost" disabled={!view.deadline} onClick={() => admin({ kind: 'pause' })}>⏸ {t.pause}</Button>}
            <Button tone="ghost" onClick={() => admin({ kind: 'extend' })}>+{t.secs(30)}</Button>
            <Button tone="ghost" onClick={() => admin({ kind: 'undo' })}>↶ {t.undo}</Button>
            <Button tone="ghost" onClick={() => admin({ kind: 'skip' })}>{t.skipWaiting}</Button>
          </div>
        )}
        {you.isHost && view.host && view.host.absent.length > 0 && (
          <div className="rounded-2xl bg-night-700/60 p-3">
            {view.host.absent.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-1">
                <span className="font-bold">{p.name}</span>
                <Button tone="ghost" className="min-h-9 text-sm" onClick={() => admin({ kind: 'rejoinCode', player: p.id })}>
                  {t.rejoinCode}
                </Button>
              </div>
            ))}
            {view.host.rejoinCodes.map((c) => (
              <div key={c.code} className="flex justify-between font-bold">
                <span>{c.name}</span>
                <span className="tracking-widest text-sky">{c.code}</span>
              </div>
            ))}
          </div>
        )}
        {you.isHost && view.phase === 'lobby' && (
          <p className="text-sm text-mist">
            {t.tvHint}: <span className="font-bold text-ink">{location.host}/tv/{view.code}</span>
          </p>
        )}
        {you.isHost && others.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-black uppercase tracking-widest text-haze">{t.host} →</div>
            <div className="flex flex-wrap gap-1.5">
              {others.map((p) => (
                <Chip key={p.id} active={successor === p.id} onClick={() => setSuccessor(p.id)}>
                  {p.name}
                </Chip>
              ))}
            </div>
            {successor && (
              <Button tone="ghost" className="mt-2 w-full" onClick={() => admin({ kind: 'transferHost', player: successor })}>
                👑 → {others.find((o) => o.id === successor)?.name}
              </Button>
            )}
          </div>
        )}
        {you.isHost && view.phase === 'game' && (
          <Button tone="ghost" onClick={() => confirm(t.endGame + '?') && admin({ kind: 'end' })}>
            {t.endGame}
          </Button>
        )}
        <Button
          tone="danger"
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
          {t.leave}
        </Button>
      </div>
    </Sheet>
  );
}

function Lobby({ view, text, send, switchGame }: { view: View; text: QuestText; send: Send; switchGame: SwitchGame }) {
  const you = view.you!;
  const [qr, setQr] = useState('');
  const url = `${location.origin}/play/${view.code}`;
  const n = view.players.length;
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#eef1ff', light: '#00000000' } }).then(setQr);
  }, [url]);
  const configure = (settings: Partial<quest.QuestSettings>) => send({ type: 'configure', settings });

  return (
    <>
      {you.isHost && (
        <Card>
          <GamePicker current="quest" onPick={switchGame} label={text.t.gameLabel} />
        </Card>
      )}
      <Card className="flex items-center gap-4">
        <div className="h-28 w-28 shrink-0 rounded-2xl bg-night-800 p-2" dangerouslySetInnerHTML={{ __html: qr }} />
        <div>
          <div className="text-4xl font-black tracking-widest">{view.code}</div>
          <div className="text-xs text-mist">{location.host}/play/{view.code}</div>
        </div>
      </Card>
      {you.isHost && !view.tvConnected && <ConnectTv room={view.code} text={text.t.connectTv} />}
      <Card>
        <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-widest text-haze">
          <span>{text.t.players}</span>
          <span>{text.num(n)}</span>
        </div>
        <ol className="flex flex-col gap-1.5">
          {view.players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-night-800 px-3 py-2 font-bold">
              <span className="w-5 text-xs text-haze">{text.num(i + 1)}</span>
              <span className={`h-2 w-2 rounded-full ${p.connected ? 'bg-village' : 'bg-haze'}`} />
              <span className="flex-1">
                {p.name}
                {p.isHost && ' 👑'}
              </span>
              {you.isHost && (
                <>
                  <button aria-label="Move up" className="h-8 w-8 rounded-full text-mist" onClick={() => send({ type: 'seat', player: p.id, by: -1 })}>↑</button>
                  <button aria-label="Move down" className="h-8 w-8 rounded-full text-mist" onClick={() => send({ type: 'seat', player: p.id, by: 1 })}>↓</button>
                  {p.id !== you.id && (
                    <button aria-label="Remove" className="h-8 w-8 rounded-full text-mafia" onClick={() => send({ type: 'admin', action: { kind: 'kick', player: p.id } })}>✕</button>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-haze">{text.t.seatingNote}</p>
      </Card>
      {you.isHost ? (
        <>
          <QuestSettingsPanel
            players={n}
            rules={view.settings.rules}
            preset={view.settings.preset}
            skin={view.settings.skin}
            text={text}
            onChange={(p) => configure(p)}
            extra={
              <>
                <Setting label={text.t.timer}>
                  {[0, 60, 120, 180, 300].map((s) => (
                    <Chip key={s} active={view.settings.discussionSeconds === s} onClick={() => configure({ discussionSeconds: s })}>
                      {s ? text.t.mins(s / 60) : text.t.off}
                    </Chip>
                  ))}
                </Setting>
                <Setting label={text.t.firstCommander}>
                  <Chip active={view.settings.firstCommander === null} onClick={() => configure({ firstCommander: null })}>
                    {text.t.random}
                  </Chip>
                  {view.players.map((p, i) => (
                    <Chip key={p.id} active={view.settings.firstCommander === i} onClick={() => configure({ firstCommander: i })}>
                      {p.name}
                    </Chip>
                  ))}
                </Setting>
              </>
            }
          />
          <div className="sticky bottom-0 bg-gradient-to-t from-night-900 via-night-900/95 to-transparent pt-4">
            <Button className="h-14 w-full text-lg" disabled={n < quest.MIN_QUEST_PLAYERS} onClick={() => send({ type: 'start' })}>
              {n < quest.MIN_QUEST_PLAYERS ? text.t.needPlayers(quest.MIN_QUEST_PLAYERS) : text.t.dealRoles}
            </Button>
          </div>
        </>
      ) : (
        <Card className="text-center font-bold">{text.t.waitingForOthers}</Card>
      )}
    </>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-night-800/70 p-4">
      <div className="mb-2 font-extrabold">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Reveal({ view, text, send }: { view: View; text: QuestText; send: Send }) {
  const you = view.you!;
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(false);
  return (
    <div className="flex flex-col items-center">
      <HoldButton
        onHold={(h) => {
          setHeld(h);
          if (h) setSeen(true);
        }}
        className="w-full max-w-[18rem] touch-none select-none"
      >
        <div className="relative min-h-[26rem] w-full overflow-hidden rounded-[2rem] ring-1 ring-white/10">
          {held ? (
            <div className="flex h-full min-h-[26rem] flex-col justify-center bg-gradient-to-b from-night-600 to-night-800 p-5">
              <CharacterReveal card={you.card!} role={you.role!} text={text} knows={you.knows} />
            </div>
          ) : (
            <div className="relative h-[26rem]">
              <CardBack className="h-full w-full" />
              <span className="absolute inset-x-0 bottom-6 text-center text-sm font-extrabold">{text.t.holdToSee}</span>
            </div>
          )}
        </div>
      </HoldButton>
      {you.seenRole ? (
        <p className="mt-6 font-bold text-mist">{text.t.waitingForOthers}</p>
      ) : (
        <Button className="mt-6 h-14 w-full text-lg" disabled={!seen || held} onClick={() => send({ type: 'seenRole' })}>
          {text.t.gotIt}
        </Button>
      )}
    </div>
  );
}

function Game({ view, text, send, clockOffset }: { view: View; text: QuestText; send: Send; clockOffset: number }) {
  const you = view.you!;
  const b = view.board!;
  const { t, terms } = text;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const [team, setTeam] = useState<string[]>([]);
  const [peek, setPeek] = useState(false);
  const left = useSecondsLeft(view.deadline, clockOffset);
  const size = b.teams[b.chapter - 1]!;
  const isCommander = b.commander === you.id;

  useEffect(() => setTeam([]), [b.phase, b.commander, b.chapter]);

  return (
    <>
      <Card className="!p-4">
        <ChapterTrack teams={b.teams} doubleFail={b.doubleFail} results={b.results} chapter={b.chapter} text={text} />
        <div className="mt-3 flex items-center justify-between">
          <RejectionTrack count={b.rejections} text={text} />
          {left !== null && <span className="font-black tabular-nums text-sun">{text.time(left)}</span>}
        </div>
      </Card>

      <HoldButton onHold={setPeek} className="w-full touch-none rounded-2xl bg-night-800 py-2 text-sm font-bold text-mist">
        {peek ? `${cardName(you.card, text.lang)} · ${terms.sides[you.side!]}` : `${t.holdToSee} 👁`}
      </HoldButton>
      {peek && (
        <Card>
          <CharacterReveal card={you.card!} role={you.role!} text={text} knows={you.knows} />
          {you.spyResults.map((r) => (
            <p key={r.target} className="mt-2 text-sm font-bold">
              🕵️ {t.spyResult(r.target, terms.sides[r.side])}
            </p>
          ))}
        </Card>
      )}

      {b.phase === 'propose' &&
        (isCommander ? (
          <Card>
            <div className="text-xl font-black">{t.proposeTeam(size)}</div>
            <div className="mt-3">
              <SeatList
                players={view.players}
                commander={b.commander}
                spy={b.spy}
                pastSpies={b.pastSpies}
                selected={team}
                onToggle={(id) => setTeam((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < size ? [...cur, id] : cur))}
                text={text}
              />
            </div>
            <Button className="mt-4 h-14 w-full text-lg" disabled={team.length !== size} onClick={() => send({ type: 'propose', team })}>
              {t.proposeButton} ({text.num(team.length)}/{text.num(size)})
            </Button>
          </Card>
        ) : (
          <Card>
            <p className="text-lg font-black">👑 {t.proposing(nameOf(b.commander), size)}</p>
            <div className="mt-3">
              <SeatList players={view.players} commander={b.commander} spy={b.spy} pastSpies={b.pastSpies} text={text} />
            </div>
          </Card>
        ))}

      {b.phase === 'vote' && (
        <Card>
          <div className="text-xl font-black">{t.voteOnTeam}</div>
          <p className="text-sm text-mist">
            {terms.commander}: {nameOf(b.commander)} · {t.votesIn(b.votesIn, view.players.length)}
          </p>
          <div className="mt-3">
            <SeatList players={view.players} commander={b.commander} team={b.team} text={text} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => send({ type: 'vote', approve: true })}
              className={`min-h-16 rounded-2xl text-lg font-black ring-2 transition active:scale-95 ${you.myVote === true ? 'bg-village text-night-950 ring-village' : 'bg-night-800 ring-village/40'}`}
            >
              👍 {t.approve}
            </button>
            <button
              onClick={() => send({ type: 'vote', approve: false })}
              className={`min-h-16 rounded-2xl text-lg font-black ring-2 transition active:scale-95 ${you.myVote === false ? 'bg-mafia text-white ring-mafia' : 'bg-night-800 ring-mafia/40'}`}
            >
              👎 {t.reject}
            </button>
          </div>
        </Card>
      )}

      {b.phase === 'chapter' &&
        (b.team?.includes(you.id) ? (
          <Card>
            <div className="text-xl font-black">{t.playCard}</div>
            {you.myPlay ? (
              <p className="mt-3 text-center font-bold text-mist">✓ {t.onTeamWaiting}</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => send({ type: 'play', card: 'success' })} className="min-h-28 rounded-2xl bg-village/15 text-xl font-black text-village ring-2 ring-village/50 active:scale-95">
                    🛡️
                    <br />
                    {terms.success}
                  </button>
                  <button
                    onClick={() => send({ type: 'play', card: 'betray' })}
                    disabled={you.side === 'good'}
                    className="min-h-28 rounded-2xl bg-mafia/15 text-xl font-black text-mafia ring-2 ring-mafia/50 active:scale-95 disabled:opacity-60"
                  >
                    🗡️
                    <br />
                    {terms.betrayal}
                  </button>
                </div>
                {you.side === 'good' && <p className="mt-2 text-center text-xs text-mist">{t.goodOnlySuccess}</p>}
              </>
            )}
          </Card>
        ) : (
          <Card className="text-center font-bold">
            ⚔️ {t.onTeamWaiting} ({text.num(b.playsIn)}/{text.num(b.team?.length ?? 0)})
          </Card>
        ))}

      {b.phase === 'spy' &&
        (b.spy === you.id ? (
          <Card>
            <div className="text-xl font-black">🕵️ {t.spyPick}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {view.players
                .filter((p) => p.id !== you.id && !b.pastSpies.includes(p.id))
                .map((p) => (
                  <Button key={p.id} tone="ghost" onClick={() => send({ type: 'spy', target: p.id })}>
                    {p.name}
                  </Button>
                ))}
            </div>
          </Card>
        ) : (
          <Card className="text-center font-bold">🕵️ {t.spyWaiting(b.spy ? nameOf(b.spy) : '?')}</Card>
        ))}

      {b.phase === 'guess' && (
        <Card>
          <div className="text-xl font-black">{t.lastChance(terms.guesser)}</div>
          {you.side === 'evil' && (
            <p className="mt-2 text-sm text-mafia">
              {t.youKnow.team} {you.knows.players.map((p) => `${p.name}${p.card ? ` (${cardName(p.card, text.lang)})` : ''}`).join(', ')}
            </p>
          )}
          {you.canGuess && (
            <>
              <p className="mt-2 text-mist">{t.guessPrompt}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {view.players
                  .filter((p) => p.id !== you.id && !you.knows.players.some((k) => k.name === p.name))
                  .map((p) => (
                    <Button key={p.id} tone="danger" onClick={() => confirm(`${p.name}?`) && send({ type: 'guess', target: p.id })}>
                      {p.name}
                    </Button>
                  ))}
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function Over({ view, text, send, switchGame }: { view: View; text: QuestText; send: Send; switchGame: SwitchGame }) {
  const o = view.outcome!;
  const { t, terms } = text;
  return (
    <div className="flex flex-col gap-3 animate-rise">
      <div className="text-center">
        <h1 className="text-4xl font-black">{o.endedByHost ? t.endedByHost : `${terms.sides[o.winner!]} ${t.wins[o.winner!]}`}</h1>
        {o.reason && <p className="mt-1 text-mist">{t.reason[o.reason](terms.guesser, o.guess ?? '')}</p>}
      </div>
      <Card>
        <ul className="grid grid-cols-2 gap-2">
          {view.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-night-800 p-2">
              {p.card && <QuestArt card={p.card} className="h-10 w-10 shrink-0" />}
              <div className="min-w-0">
                <div className="line-clamp-2 break-words text-sm font-extrabold leading-tight">{p.name}</div>
                {p.role && <div className={`line-clamp-2 break-words text-xs font-bold leading-tight ${quest.sideOf(p.role) === 'good' ? 'text-village' : 'text-mafia'}`}>{cardName(p.card, text.lang)}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {view.you!.isHost && (
        <>
          <Button className="h-14 text-lg" onClick={() => send({ type: 'admin', action: { kind: 'rematch' } })}>
            {t.playAgain}
          </Button>
          <Button tone="ghost" onClick={() => switchGame('mafia')}>
            {t.switchToMafia}
          </Button>
        </>
      )}
    </div>
  );
}

export function QuestAnnouncement({ view, text, big = false }: { view: View; text: QuestText; big?: boolean }) {
  const [hidden, setHidden] = useState<number | null>(null);
  const a = view.announcement;
  useEffect(() => {
    if (!a) return;
    const timer = setTimeout(() => setHidden(a.seq), big ? 9000 : 7000);
    return () => clearTimeout(timer);
  }, [a, big]);
  if (!a || hidden === a.seq || view.phase === 'lobby' || (a.kind === 'host' && big)) return null;
  const { t, terms } = text;

  let body: React.ReactNode = a.hostEvent === 'newHost' ? t.newHost(a.name ?? '') : a.hostEvent === 'undo' ? t.undone : null;
  if (a.kind === 'vote') {
    body = (
      <>
        <div className={`font-black ${a.approved ? 'text-village' : 'text-mafia'}`}>{a.approved ? t.teamApproved : t.teamRejected}</div>
        <div className="mt-1 text-mist">
          👍 {text.num(a.yes ?? 0)} · 👎 {text.num(a.no ?? 0)}
        </div>
        {a.votes && (
          <div className={`mt-3 grid gap-2 ${big ? 'grid-cols-5' : 'grid-cols-2'}`}>
            {a.votes.map((v, i) => (
              <div key={v.name} className={`break-words rounded-xl px-2 py-1.5 text-sm font-bold leading-tight animate-flip ${v.approve ? 'bg-village/20 text-village' : 'bg-mafia/20 text-mafia'}`} style={{ animationDelay: `${i * 60}ms` }}>
                {v.approve ? '👍' : '👎'} {v.name}
              </div>
            ))}
          </div>
        )}
      </>
    );
  } else if (a.kind === 'chapter') {
    const cards = [...Array(a.successes ?? 0).fill('success'), ...Array(a.betrayals ?? 0).fill('betray')].sort(() => (a.seq % 2 ? 1 : -1) * 0.5 - 0.25);
    body = (
      <>
        <div className="font-black">
          {terms.chapter} {text.num(a.chapter ?? 0)}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {cards.map((c, i) => (
            <div
              key={i}
              className={`grid place-items-center rounded-xl font-black animate-flip ${big ? 'h-[12vw] w-[8vw] text-[3vw]' : 'h-20 w-14 text-2xl'} ${c === 'success' ? 'bg-village/25 text-village' : 'bg-mafia/30 text-mafia'}`}
              style={{ animationDelay: `${300 + i * 500}ms` }}
            >
              {c === 'success' ? '🛡️' : '🗡️'}
            </div>
          ))}
        </div>
        <div className={`mt-3 font-black ${a.chapterWinner === 'good' ? 'text-village' : 'text-mafia'} animate-rise`} style={{ animationDelay: `${400 + cards.length * 500}ms` }}>
          {terms.sides[a.chapterWinner!]} {t.wins[a.chapterWinner!]}
        </div>
      </>
    );
  } else if (a.kind === 'spy') {
    body = <div className="font-black">🕵️ {t.spyChecked(a.spy ?? '', a.target ?? '')}</div>;
  }

  return (
    <div className={`fixed inset-0 z-30 flex items-center justify-center bg-night-950/75 p-6 backdrop-blur-sm ${text.font}`} onClick={() => setHidden(a.seq)}>
      <Card className={`w-full text-center animate-rise ${big ? 'max-w-4xl !p-10 text-[2.4vw]' : 'max-w-sm text-lg'}`}>{body}</Card>
    </div>
  );
}
