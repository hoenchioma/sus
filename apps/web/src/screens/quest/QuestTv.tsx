import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { quest } from '@sus/engine';
import { QuestArt } from '../../art/QuestArt';
import { Button } from '../../components/ui';
import { inTvApp, unlockAudio, useQuestCues } from '../../lib/audio';
import { formatClock, useRoom, useSecondsLeft } from '../../lib/room';
import { useWakeLock } from '../../lib/wakeLock';
import { cardName } from '../../skins/quest';
import { ChapterTrack, RejectionTrack, useQuestText, type QuestText } from './parts';
import { QuestAnnouncement } from './QuestPlay';

type View = quest.QuestRoomView;

export function QuestTv({ code }: { code: string }) {
  const { view, status, clockOffset, quotaResetAt, storageFullUntil } = useRoom<View, quest.QuestCommand>(code, 'tv');
  const text = useQuestText(view?.settings.skin ?? 'polashi');
  const [sound, setSound] = useState(() => inTvApp && (unlockAudio() || true));
  useWakeLock();
  useQuestCues(view?.cue ?? null, { enabled: sound, skin: view?.settings.skin ?? 'polashi', lang: text.lang, lines: text.t.cues });

  if (status === 'missing') return <div className={`grid min-h-dvh place-items-center text-[3vw] font-black ${text.font}`}>{text.t.roomMissing(code)}</div>;
  if (status === 'quota') {
    return (
      <div className={`grid min-h-dvh place-items-center p-[4vw] text-center text-[2.5vw] font-black ${text.font}`}>
        {text.t.quotaBody(formatClock(quotaResetAt ?? Date.now(), text.lang))}
      </div>
    );
  }
  if (!view) return <div className="grid min-h-dvh place-items-center text-[3vw] font-black">…</div>;

  return (
    <div className={`flex min-h-dvh flex-col gap-[2vw] p-[3vw] ${text.font}`}>
      <header className="flex items-center justify-between">
        <div className="text-[2.5vw] font-black">
          {text.terms.game} <span className="text-mist">· {view.code}</span>
        </div>
        {!sound && (
          <Button tone="ghost" onClick={() => setSound(unlockAudio() || true)}>
            🔊
          </Button>
        )}
      </header>
      {storageFullUntil && (
        <p className="rounded-2xl bg-sun/15 px-[2vw] py-[0.8vw] text-center text-[1.4vw] font-bold text-sun">
          {text.t.quotaBanner(formatClock(storageFullUntil, text.lang))}
        </p>
      )}
      <main className="flex flex-1 flex-col items-center justify-center">
        {view.phase === 'lobby' && <Lobby view={view} text={text} />}
        {view.phase === 'reveal' && <h1 className="text-[5vw] font-black">{text.t.holdToSee}</h1>}
        {view.phase === 'game' && <Board view={view} text={text} clockOffset={clockOffset} />}
        {view.phase === 'over' && <Over view={view} text={text} />}
      </main>
      <QuestAnnouncement view={view} text={text} big />
    </div>
  );
}

function Lobby({ view, text }: { view: View; text: QuestText }) {
  const [qr, setQr] = useState('');
  const url = `${location.origin}/play/${view.code}`;
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#eef1ff', light: '#00000000' } }).then(setQr);
  }, [url]);
  return (
    <div className="grid w-full grid-cols-2 items-center gap-[4vw]">
      <div className="flex flex-col items-center">
        <div className="w-[26vw] rounded-[2vw] bg-night-800 p-[2vw]" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="mt-[1vw] text-[7vw] font-black tracking-[0.2em]">{view.code}</div>
      </div>
      <div>
        <div className="mb-[1vw] flex -space-x-[1.5vw]">
          {['mirMadan', 'siraj', 'mirJafar', 'ghoseti'].map((c) => (
            <QuestArt key={c} card={view.settings.skin === 'avalon' ? ({ mirMadan: 'merlin', siraj: 'percival', mirJafar: 'assassin', ghoseti: 'morgana' } as Record<string, string>)[c]! : c} className="h-[9vw] w-[9vw] animate-float" />
          ))}
        </div>
        <h2 className="text-[3vw] font-black">
          {text.t.players} · {text.num(view.players.length)}
        </h2>
        <ul className="mt-[1.5vw] flex flex-wrap gap-[1vw]">
          {view.players.map((p) => (
            <li key={p.id} className="rounded-full bg-night-700 px-[1.5vw] py-[0.6vw] text-[2vw] font-bold">
              {p.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Board({ view, text, clockOffset }: { view: View; text: QuestText; clockOffset: number }) {
  const b = view.board!;
  const { t, terms } = text;
  const left = useSecondsLeft(view.deadline, clockOffset);
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const size = b.teams[b.chapter - 1]!;
  const status =
    b.phase === 'propose' ? t.proposing(nameOf(b.commander), size) :
    b.phase === 'vote' ? `${t.voteOnTeam} · ${t.votesIn(b.votesIn, view.players.length)}` :
    b.phase === 'chapter' ? `${t.onTeamWaiting} ${text.num(b.playsIn)}/${text.num(b.team?.length ?? 0)}` :
    b.phase === 'spy' ? t.spyWaiting(b.spy ? nameOf(b.spy) : '?') :
    b.phase === 'guess' ? t.lastChance(terms.guesser) : '';

  return (
    <div className="flex w-full flex-col items-center gap-[2.5vw]">
      <div className="w-[70vw]">
        <ChapterTrack teams={b.teams} doubleFail={b.doubleFail} results={b.results} chapter={b.chapter} text={text} big />
      </div>
      <div className="flex items-center gap-[4vw]">
        <RejectionTrack count={b.rejections} text={text} big />
        {left !== null && <span className="text-[3vw] font-black tabular-nums text-sun">{text.time(left)}</span>}
      </div>
      <p className={`text-center text-[3vw] font-black ${b.phase === 'guess' ? 'text-mafia animate-pulse' : ''}`}>{status}</p>
      <ul className="flex max-w-[90vw] flex-wrap justify-center gap-[1.2vw]">
        {view.players.map((p) => {
          const onTeam = b.team?.includes(p.id);
          return (
            <li
              key={p.id}
              className={`flex items-center gap-[0.6vw] rounded-full px-[1.6vw] py-[0.7vw] text-[1.8vw] font-extrabold ring-[0.25vw] transition ${
                onTeam ? 'bg-night-600 ring-sun' : 'bg-night-800 ring-transparent'
              } ${p.absent ? 'opacity-40' : ''}`}
            >
              {b.commander === p.id && '👑'}
              {onTeam && '⚔️'}
              {b.spy === p.id && '🕵️'}
              {p.name}
            </li>
          );
        })}
      </ul>
      {b.lastVote && !view.settings.rules.anonymousVotes && b.phase !== 'vote' && (
        <p className="text-[1.5vw] text-mist">
          {b.lastVote.approved ? t.teamApproved : t.teamRejected}:{' '}
          {Object.entries(b.lastVote.votes)
            .map(([id, yes]) => `${yes ? '👍' : '👎'}${nameOf(id)}`)
            .join('  ')}
        </p>
      )}
    </div>
  );
}

function Over({ view, text }: { view: View; text: QuestText }) {
  const o = view.outcome!;
  const { t, terms } = text;
  return (
    <div className="flex flex-col items-center gap-[2vw] text-center">
      <h1 className="text-[6vw] font-black leading-none animate-rise">{o.endedByHost ? t.endedByHost : `${terms.sides[o.winner!]} ${t.wins[o.winner!]}`}</h1>
      {o.reason && <p className="text-[2vw] text-mist">{t.reason[o.reason](terms.guesser, o.guess ?? '')}</p>}
      <div className="grid grid-cols-5 gap-[1.5vw]">
        {view.players.map((p, i) => (
          <div key={p.id} className="flex flex-col items-center animate-rise" style={{ animationDelay: `${i * 140}ms` }}>
            {p.card && <QuestArt card={p.card} className="h-[9vw] w-[9vw]" />}
            <div className="text-[1.8vw] font-extrabold">{p.name}</div>
            {p.role && <div className={`text-[1.3vw] font-bold ${quest.sideOf(p.role) === 'good' ? 'text-village' : 'text-mafia'}`}>{cardName(p.card, text.lang)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
