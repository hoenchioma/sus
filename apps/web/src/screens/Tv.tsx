import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { teamOf, type RoomView } from '@sus/engine';
import { RoleArt } from '../art/RoleArt';
import { AnnouncementCard } from '../components/Announcement';
import { Button, TEAM_TEXT } from '../components/ui';
import { inTvApp, unlockAudio, useCues } from '../lib/audio';
import { promptName } from '../lib/describe';
import { formatClock, formatTime, useRoom, useSecondsLeft } from '../lib/room';
import { useWakeLock } from '../lib/wakeLock';
import { SKINS, type Skin, type SkinId } from '../skins';

export function Tv({ code }: { code: string }) {
  const { view, status, clockOffset, quotaResetAt, storageFullUntil } = useRoom(code, 'tv');
  const [sound, setSound] = useState(() => inTvApp && (unlockAudio() || true));
  const skin = SKINS[(view?.settings.skin as SkinId) ?? 'mafia'];
  useWakeLock();
  useCues(view?.cue ?? null, skin, { enabled: sound, narrated: view?.settings.nightStyle === 'narrated' });

  if (status === 'missing') return <Centered>Room {code} not found</Centered>;
  if (status === 'quota') return <Centered>Phone games are paused until {formatClock(quotaResetAt ?? Date.now())}: today's free server allowance is used up.</Centered>;
  if (!view) return <Centered>Connecting…</Centered>;

  return (
    <div className="flex min-h-dvh flex-col p-[3vw]">
      <header className="flex items-center justify-between">
        <div className="text-[2.5vw] font-black">
          Sus<span className="text-mafia">.</span> <span className="text-mist">· {view.code}</span>
        </div>
        {!sound && (
          <Button tone="ghost" onClick={() => setSound(unlockAudio() || true)}>
            🔊 Tap to turn on sound
          </Button>
        )}
      </header>
      {storageFullUntil && (
        <p className="mt-[1vw] rounded-2xl bg-sun/15 px-[2vw] py-[0.8vw] text-center text-[1.4vw] font-bold text-sun">
          {`The server can't save games until ${formatClock(storageFullUntil)}. This game keeps going, but if every phone drops it may be lost.`}
        </p>
      )}
      <main className="flex flex-1 flex-col items-center justify-center">
        {view.phase === 'lobby' && <TvLobby view={view} />}
        {view.phase === 'reveal' && <Big title="Check your role" sub="Hold your card to peek. Keep it secret." />}
        {view.phase === 'night' && <TvNight view={view} skin={skin} />}
        {view.phase === 'day' && <TvDay view={view} clockOffset={clockOffset} />}
        {view.phase === 'over' && <TvOver view={view} skin={skin} />}
      </main>
      {view.phase !== 'lobby' && <PlayerStrip view={view} skin={skin} />}
      <TvAnnouncement view={view} skin={skin} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center text-[3vw] font-black">{children}</div>;
}

function Big({ title, sub, icon }: { title: string; sub?: string; icon?: string }) {
  return (
    <div className="text-center animate-rise">
      {icon && <div className="text-[8vw] animate-float">{icon}</div>}
      <h1 className="text-[6vw] font-black leading-none">{title}</h1>
      {sub && <p className="mt-[1.5vw] text-[2vw] text-mist">{sub}</p>}
    </div>
  );
}

function TvLobby({ view }: { view: RoomView }) {
  const [qr, setQr] = useState('');
  const url = `${location.origin}/play/${view.code}`;
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#eef1ff', light: '#00000000' } }).then(setQr);
  }, [url]);
  return (
    <div className="grid w-full grid-cols-2 items-center gap-[4vw]">
      <div className="flex flex-col items-center">
        <div className="w-[26vw] rounded-[2vw] bg-night-800 p-[2vw]" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-[1.5vw] text-[1.6vw] text-mist">{location.host}/play</p>
        <div className="text-[7vw] font-black tracking-[0.2em]">{view.code}</div>
      </div>
      <div>
        <h2 className="text-[3vw] font-black">Players · {view.players.length}</h2>
        <ul className="mt-[1.5vw] flex flex-wrap gap-[1vw]">
          {view.players.map((p) => (
            <li key={p.id} className="rounded-full bg-night-700 px-[1.5vw] py-[0.6vw] text-[2vw] font-bold animate-rise">
              {p.name}
              {p.isHost && ' 👑'}
            </li>
          ))}
        </ul>
        <p className="mt-[2vw] text-[1.6vw] text-mist">Waiting for {view.hostName ?? 'the host'} to deal…</p>
      </div>
    </div>
  );
}

function TvNight({ view, skin }: { view: RoomView; skin: Skin }) {
  const night = view.night!;
  if (night.style === 'quick') return <Big icon="🌙" title={`Night ${night.number}`} sub="Make your choices. Keep your screen to yourself." />;
  if (night.stage === 'ready') return <Big icon="🌙" title="Night is coming" sub={`Tap "I'm ready" on your phone (${night.readyCount} ready)`} />;
  return (
    <Big
      icon={night.stage === 'sleep' ? '😴' : '👁️'}
      title={night.calling ? `${promptName(skin, night.calling)}, ${night.stage === 'sleep' ? 'close your eyes' : 'open your eyes'}` : 'Everyone, close your eyes'}
      sub="Everyone else, keep your eyes closed."
    />
  );
}

function TvDay({ view, clockOffset }: { view: RoomView; clockOffset: number }) {
  const day = view.day!;
  const left = useSecondsLeft(view.deadline, clockOffset);
  const living = view.players.filter((p) => p.alive).length;
  return (
    <div className="flex w-full flex-col items-center gap-[2vw] text-center">
      <h1 className="text-[5vw] font-black leading-none">☀️ Day {day.number}</h1>
      {day.stage === 'discussion' && (
        <>
          <div className="text-[12vw] font-black tabular-nums leading-none">{left !== null ? formatTime(left) : view.paused ? 'Paused' : ''}</div>
          <p className="text-[2vw] text-mist">Discuss. Who's sus?</p>
        </>
      )}
      {(day.stage === 'vote' || day.stage === 'runoff') && (
        <>
          <p className="text-[3vw] font-black">{day.stage === 'runoff' ? 'Runoff vote' : 'Vote on your phones'}</p>
          {day.stage === 'runoff' && (
            <p className="text-[2.5vw] font-bold text-sun">
              {day.candidates.map((id) => view.players.find((p) => p.id === id)?.name).join('  vs  ')}
            </p>
          )}
          <p className="text-[2vw] text-mist">
            {day.votesCast} of {day.voters} voted
          </p>
        </>
      )}
      {day.stage === 'hostPick' && <p className="text-[3vw] font-black">Still tied: the host decides</p>}
      {day.tally.length > 0 && (
        <div className="w-[50vw] space-y-[0.8vw]">
          {day.tally.map((t) => (
            <div key={t.name} className="flex items-center gap-[1vw] text-[2vw] font-bold">
              <span className="w-[14vw] truncate text-right">{t.name}</span>
              <div className="h-[2vw] rounded-full bg-mafia transition-all duration-700" style={{ width: `${(t.votes / Math.max(1, day.totalVotes)) * 30}vw` }} />
              <span className="tabular-nums">{t.votes}</span>
            </div>
          ))}
        </div>
      )}
      {day.ballots.length > 0 && (
        <p className="max-w-[80vw] text-[1.4vw] text-mist">
          {day.ballots.map((b) => `${b.ghost ? '👻' : ''}${b.voter} → ${b.target ?? 'skip'}`).join('   ·   ')}
        </p>
      )}
      <div className="flex gap-[2vw]">
        <Stat label="Alive" value={living} />
        <Stat label="Votes" value={day.totalVotes} />
        <Stat label="Needed" value={day.needed ?? 'Most'} />
      </div>
      {day.blockedPartner && <p className="text-[1.8vw] font-bold text-rose">💗 {day.blockedPartner} can't vote today</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-[12vw] rounded-[1.5vw] bg-night-800 px-[2vw] py-[1vw]">
      <div className="text-[4vw] font-black tabular-nums leading-none">{value}</div>
      <div className="text-[1.2vw] font-bold uppercase tracking-wider text-mist">{label}</div>
    </div>
  );
}

function TvOver({ view, skin }: { view: RoomView; skin: Skin }) {
  const skinId = view.settings.skin as SkinId;
  return (
    <div className="flex w-full flex-col items-center gap-[2vw] text-center">
      <h1 className="text-[6vw] font-black leading-none animate-rise">{view.endedByHost ? 'Game ended' : skin.wins[view.winner!]}</h1>
      <div className="grid grid-cols-5 gap-[1.5vw]">
        {view.players.map((p, i) => (
          <div key={p.id} className="flex flex-col items-center animate-rise" style={{ animationDelay: `${i * 120}ms` }}>
            {p.shownRole && <RoleArt role={p.shownRole} skin={skinId} dead={!p.alive} className="h-[9vw] w-[9vw]" />}
            <div className="text-[1.8vw] font-extrabold">{p.name}</div>
            {p.shownRole && <div className={`text-[1.3vw] font-bold ${TEAM_TEXT[teamOf(p.shownRole)]}`}>{skin.roles[p.shownRole].name}</div>}
          </div>
        ))}
      </div>
      {view.stats && (
        <div className="flex gap-[3vw] text-[1.8vw]">
          <span>🔮 Oracle: <b>{view.stats.oracle ?? '—'}</b></span>
          <span>🎭 Poker face: <b>{view.stats.pokerFace ?? '—'}</b></span>
          <span>👀 Most suspected: <b>{view.stats.mostSuspected ?? '—'}</b></span>
        </div>
      )}
    </div>
  );
}

function PlayerStrip({ view, skin }: { view: RoomView; skin: Skin }) {
  if (view.phase === 'over') return null;
  return (
    <footer className="flex flex-wrap justify-center gap-[1vw]">
      {view.players.map((p) => (
        <div key={p.id} className={`rounded-full px-[1.2vw] py-[0.5vw] text-[1.4vw] font-bold ${p.alive ? 'bg-night-700' : 'bg-night-800 text-haze line-through'}`}>
          {p.name}
          {!p.alive && p.shownRole && <span className="no-underline"> · {skin.roles[p.shownRole].name}</span>}
          {!p.alive && p.shownTeam && <span> · {skin.teams[p.shownTeam as keyof Skin['teams']]}</span>}
          {p.absent && ' · away'}
        </div>
      ))}
    </footer>
  );
}

function TvAnnouncement({ view, skin }: { view: RoomView; skin: Skin }) {
  const [hidden, setHidden] = useState<number | null>(null);
  const a = view.announcement;
  useEffect(() => {
    if (!a) return;
    const t = setTimeout(() => setHidden(a.seq), 9000);
    return () => clearTimeout(t);
  }, [a]);
  if (!a || hidden === a.seq || a.kind === 'host' || view.phase === 'lobby') return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-night-950/80 backdrop-blur" onClick={() => setHidden(a.seq)}>
      <AnnouncementCard announcement={a} skin={skin} skinId={view.settings.skin as SkinId} big />
    </div>
  );
}
