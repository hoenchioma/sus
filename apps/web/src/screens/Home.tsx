import { RoleArt } from '../art/RoleArt';
import { Button, Screen } from '../components/ui';

export function Home({ canContinue, onContinue, onNew }: { canContinue: boolean; onContinue: () => void; onNew: () => void }) {
  return (
    <Screen className="justify-between">
      <div className="mt-[12vh] flex flex-col items-center text-center animate-rise">
        <div className="relative mb-2 flex -space-x-6">
          <RoleArt role="villager" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-2s]" />
          <RoleArt role="mafia" className="relative z-10 h-32 w-32 animate-float" />
          <RoleArt role="detective" className="h-24 w-24 translate-y-3 animate-float [animation-delay:-4s]" />
        </div>
        <h1 className="text-7xl font-black tracking-tight">
          Sus<span className="text-mafia">.</span>
        </h1>
        <p className="mt-3 max-w-xs text-mist">Run Mafia &amp; Werewolf nights without losing track of who did what.</p>
      </div>

      <div className="flex flex-col gap-3 animate-rise [animation-delay:120ms]">
        {canContinue && (
          <Button onClick={onContinue} className="h-14 text-lg">
            Continue game
          </Button>
        )}
        <Button tone={canContinue ? 'ghost' : 'primary'} onClick={onNew} className="h-14 text-lg">
          New game
        </Button>
        <p className="text-center text-xs text-haze">Mode 1 · one phone, the host runs the night</p>
      </div>
    </Screen>
  );
}
