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
import { roomGame } from './lib/room';

export interface Saved {
  game: Game;
  skin: SkinId;
  revealed: boolean;
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
  useEffect(() => {
    roomGame(code).then(setGame).catch(() => setGame(null));
  }, [code]);
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
          setSaved({ game: newGame(setup), skin: draft.skin, revealed });
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
