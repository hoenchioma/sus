import { useEffect, useState } from 'react';
import { newGame, type Game, type PresetId, type RoleCounts, type RoleId, type RuleChoices } from '@sus/engine';
import { Sky } from './components/ui';
import { useStored } from './lib/storage';
import type { SkinId } from './skins';
import { Home } from './screens/Home';
import { SetupScreen } from './screens/Setup';
import { Reveal } from './screens/Reveal';
import { Board } from './screens/Board';
import { GameOver } from './screens/GameOver';
import { Play } from './screens/Play';
import { Tv } from './screens/Tv';
import { QuestPlay } from './screens/quest/QuestPlay';
import { QuestTv } from './screens/quest/QuestTv';
import { QuestLocal } from './screens/quest/QuestLocal';
import { formatClock, QuotaError, roomGame } from './lib/room';
import { QuotaNotice } from './components/Quota';
import { TvPair } from './screens/TvPair';
import { LinkTv } from './screens/LinkTv';
import { useReportGame } from './lib/stats';

export interface Saved {
  game: Game;
  skin: SkinId;
  revealed: boolean;
  /** For stats: identifies this game and when it began. Older saves don't have them. */
  id?: string;
  startedAt?: number;
}

export interface Draft {
  names: string[];
  counts: RoleCounts;
  rules: RuleChoices;
  preset: PresetId;
  skin: SkinId;
  deal: 'app' | 'manual';
  assigned: Record<number, RoleId>;
}

export interface Group {
  name: string;
  names: string[];
}

export const emptyDraft: Draft = {
  names: [],
  counts: {},
  rules: {},
  preset: 'classic',
  skin: 'mafia',
  deal: 'app',
  assigned: {},
};

export function App() {
  const [, kind, code] = location.pathname.match(/^\/(play|tv)\/([A-Za-z]{4})\/?$/) ?? [];
  if (kind && code) {
    return (
      <>
        <Sky />
        <RoomGate code={code.toUpperCase()} tv={kind === 'tv'} />
      </>
    );
  }
  const link = location.pathname.match(/^\/link\/(\d{4})\/?$/);
  if (link) {
    return (
      <>
        <Sky />
        <LinkTv code={link[1]!} />
      </>
    );
  }
  if (/^\/tv\/?$/.test(location.pathname)) {
    return (
      <>
        <Sky />
        <TvPair />
      </>
    );
  }
  if (location.pathname === '/quest') {
    return (
      <>
        <Sky />
        <QuestLocal />
      </>
    );
  }
  return <LocalApp />;
}

/** Asks the server which game a room is before loading that game's screens. */
function RoomGate({ code, tv }: { code: string; tv: boolean }) {
  const [game, setGame] = useState<'mafia' | 'quest' | null | undefined>(undefined);
  const [quotaResetAt, setQuotaResetAt] = useState<number | null>(null);
  useEffect(() => {
    roomGame(code)
      .then(setGame)
      .catch((error) => {
        if (error instanceof QuotaError) setQuotaResetAt(error.resetAt);
        else setGame(null);
      });
  }, [code]);
  if (quotaResetAt !== null) {
    // Which game the room holds is unknown here, so say it in both languages.
    return (
      <QuotaNotice
        title="Phone games are paused · ফোনে খেলা আপাতত বন্ধ"
        body={`Today's free server allowance is used up. Phone games work again at ${formatClock(quotaResetAt)}. Meanwhile you can still play on one phone. · ${formatClock(quotaResetAt, 'bn')}-এ আবার চালু হবে, এর মধ্যে এক ফোনে খেলা যাবে।`}
        className="font-bangla"
        action="Play on one phone · এক ফোনে খেলুন"
        onAction={() => location.assign('/')}
      />
    );
  }
  if (game === undefined) return null;
  if (game === 'quest') return tv ? <QuestTv code={code} /> : <QuestPlay code={code} />;
  return tv ? <Tv code={code} /> : <Play code={code} />;
}

function LocalApp() {
  const [saved, setSaved] = useStored<Saved | null>('sus.game', null);
  const [draft, setDraft] = useStored<Draft>('sus.draft', emptyDraft);
  const [groups, setGroups] = useStored<Group[]>('sus.groups', []);
  const [screen, setScreen] = useState<'home' | 'setup' | 'play'>(saved ? 'play' : 'home');

  const update = (game: Game) => setSaved((s) => (s ? { ...s, game } : s));
  const ended = saved?.game.ended ? saved : null;
  const statsId = saved ? saved.id ?? `mafia-${saved.game.setup.players[0]?.id}` : '';
  useReportGame(
    ended && { family: 'mafia', id: statsId, skin: ended.skin, startedAt: ended.startedAt ?? null, game: ended.game },
    ended ? `${statsId}:${ended.game.cursor}:${ended.game.ended}` : '',
  );

  let content;
  if (screen === 'setup') {
    content = (
      <SetupScreen
        draft={draft}
        setDraft={setDraft}
        groups={groups}
        setGroups={setGroups}
        onBack={() => setScreen('home')}
        onStart={(setup, revealed) => {
          setSaved({ game: newGame(setup), skin: draft.skin, revealed, id: crypto.randomUUID(), startedAt: Date.now() });
          setScreen('play');
        }}
      />
    );
  } else if (screen === 'play' && saved) {
    if (!saved.revealed) {
      content = <Reveal saved={saved} onDone={() => setSaved({ ...saved, revealed: true })} />;
    } else if (saved.game.ended) {
      content = (
        <GameOver
          saved={saved}
          onRematch={() => {
            setSaved(null);
            setScreen('setup');
          }}
          onHome={() => {
            setSaved(null);
            setScreen('home');
          }}
          onResume={() => update({ ...saved.game, ended: undefined })}
        />
      );
    } else {
      content = <Board saved={saved} update={update} onQuit={() => setScreen('home')} />;
    }
  } else {
    content = (
      <Home
        canContinue={!!saved}
        onContinue={() => setScreen('play')}
        onNew={() => {
          setSaved(null);
          setScreen('setup');
        }}
      />
    );
  }

  return (
    <>
      <Sky />
      {content}
    </>
  );
}
