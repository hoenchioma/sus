import { useState } from 'react';
import { rulesOf, teamOf } from '@sus/engine';
import type { Saved } from '../App';
import { CardBack } from '../art/RoleArt';
import { RoleFace } from '../components/RoleCard';
import { Button, HoldButton, Screen } from '../components/ui';
import { roleGuide } from '../lib/guide';
import { SKINS } from '../skins';

export function Reveal({ saved, onDone }: { saved: Saved; onDone: () => void }) {
  const { setup } = saved.game;
  const skin = SKINS[saved.skin];
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(false);
  const player = setup.players[index];

  if (!player) {
    return (
      <Screen className="items-center justify-center text-center">
        <CardBack className="h-48 animate-float" />
        <h1 className="mt-6 text-3xl font-black">Everyone's in</h1>
        <p className="mt-2 max-w-xs text-mist">Hand the phone back to the host. Night is about to fall.</p>
        <Button className="mt-8 h-14 w-full text-lg" onClick={onDone}>
          Start night 1
        </Button>
      </Screen>
    );
  }

  const role = setup.roles[player.id]!;
  const team = teamOf(role);
  const teammates =
    team === 'mafia'
      ? setup.players.filter((p) => p.id !== player.id && teamOf(setup.roles[p.id]!) === 'mafia')
      : [];

  return (
    <Screen className="items-center text-center">
      <p className="mt-6 text-sm font-bold uppercase tracking-widest text-haze">
        {index + 1} of {setup.players.length}
      </p>
      <h1 className="mt-2 text-4xl font-black">Pass to {player.name}</h1>
      <p className="mt-1 text-mist">Only {player.name} should look.</p>

      <HoldButton
        onHold={(h) => {
          setHeld(h);
          if (h) setSeen(true);
        }}
        className="mt-6 w-full max-w-[18rem] touch-none select-none"
      >
        {/* The face grows to fit the guide; the back keeps the card's shape. */}
        <div className={`relative w-full overflow-hidden rounded-[2rem] ring-1 ring-white/10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ${held ? 'min-h-[24rem]' : 'aspect-[3/4]'}`}>
          {held ? (
            <RoleFace
              role={role}
              skin={skin}
              guide={roleGuide(role, skin, rulesOf(setup), new Set(Object.values(setup.roles)), 'tracker')}
              teammates={teammates.map((p) => `${p.name} (${skin.roles[setup.roles[p.id]!].name})`)}
            />
          ) : (
            <div className="relative h-full">
              <CardBack className="h-full w-full" />
              <span className="absolute inset-x-0 bottom-6 text-sm font-extrabold text-ink/90">Hold to reveal</span>
            </div>
          )}
        </div>
      </HoldButton>

      <Button
        className="mt-8 h-14 w-full text-lg"
        disabled={!seen || held}
        onClick={() => {
          setIndex(index + 1);
          setSeen(false);
        }}
      >
        Done, pass it on
      </Button>
    </Screen>
  );
}
