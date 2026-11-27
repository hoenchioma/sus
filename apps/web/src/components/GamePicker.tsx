/** The host's switch between the two game families; the room, players and TV all stay. */
export function GamePicker({ current, onPick, label }: { current: 'mafia' | 'quest'; onPick: (game: 'mafia' | 'quest') => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-black uppercase tracking-widest text-haze">{label}</span>
      <div className="flex gap-1 rounded-full bg-night-800 p-1">
        {(
          [
            ['mafia', 'Mafia · Werewolf'],
            ['quest', 'পলাশী · Avalon'],
          ] as const
        ).map(([id, name]) => (
          <button
            key={id}
            onClick={() => id !== current && onPick(id)}
            aria-pressed={id === current}
            className={`rounded-full px-3 py-1.5 text-sm font-extrabold transition ${id === current ? 'bg-sky text-night-950' : 'text-mist'}`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
