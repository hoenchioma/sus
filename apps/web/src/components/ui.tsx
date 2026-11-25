import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Tone = 'primary' | 'ghost' | 'danger' | 'quiet';

const TONES: Record<Tone, string> = {
  primary:
    'bg-gradient-to-b from-sky to-[#3d8cf0] text-night-950 shadow-[0_8px_24px_-8px_rgba(90,184,255,0.8)] hover:brightness-110',
  ghost: 'bg-night-700/70 text-ink ring-1 ring-white/10 hover:bg-night-600/80',
  danger:
    'bg-gradient-to-b from-mafia to-[#e0365a] text-white shadow-[0_8px_24px_-8px_rgba(255,84,112,0.8)] hover:brightness-110',
  quiet: 'text-mist hover:text-ink',
};

export function Button({
  tone = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-extrabold tracking-wide transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${TONES[tone]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card bg-gradient-to-b from-night-700/80 to-night-800/80 p-5 ring-1 ring-white/[0.06] shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  disabled,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 rounded-full px-4 text-sm font-bold transition active:scale-95 disabled:opacity-35 ${
        active ? 'bg-sky text-night-950 shadow-[0_0_18px_-4px_rgba(90,184,255,0.9)]' : 'bg-night-600/60 text-ink hover:bg-night-500/70'
      }`}
    >
      {children}
    </button>
  );
}

export function Sky() {
  const stars = useRef(
    Array.from({ length: 36 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 60,
      r: Math.random() * 1.4 + 0.4,
      d: Math.random() * 3,
    })),
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#1f2b66_0%,#0b1026_55%,#070a1c_100%)]" />
      {stars.current.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2, animationDelay: `${s.d}s` }}
        />
      ))}
      <div className="absolute -bottom-40 left-1/2 h-80 w-[140%] -translate-x-1/2 rounded-[50%] bg-[#0e1535] blur-2xl" />
    </div>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] ${className}`}>
      {children}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-night-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-night-800 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] ring-1 ring-white/10 animate-rise">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
        <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Calls `onHold(true)` while pressed and `onHold(false)` on release, for hold-to-peek. */
export function HoldButton({
  onHold,
  children,
  className = '',
}: {
  onHold: (held: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onPointerDown={() => onHold(true)}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function Countdown({ seconds, onDone }: { seconds: number; onDone?: () => void }) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    setLeft(seconds);
    const start = Date.now();
    const timer = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        done.current?.();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);
  return <span className="tabular-nums">{left}s</span>;
}

export const TEAM_TEXT = {
  village: 'text-village',
  mafia: 'text-mafia',
  neutral: 'text-neutral',
} as const;
