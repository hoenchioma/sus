import { useId, type ReactNode } from 'react';
import type { RoleId } from '@sus/engine';
import type { SkinId } from '../skins';

type Eyes = 'round' | 'sly' | 'heavy' | 'squint' | 'dreamy' | 'glow' | 'shades' | 'mask' | 'side';

interface Look {
  body: string;
  shade: string;
  eyes: Eyes;
  back?: ReactNode;
  front?: ReactNode;
  wolf?: boolean;
}

const lantern = (
  <g transform="translate(88 70)">
    <circle r="14" fill="#ffd36e" opacity="0.25" />
    <rect x="-6" y="-8" width="12" height="16" rx="4" fill="#ffd36e" />
    <rect x="-7" y="-11" width="14" height="4" rx="2" fill="#3b2a4a" />
    <path d="M-3 -11 q3 -6 6 0" stroke="#3b2a4a" strokeWidth="2" fill="none" />
  </g>
);

const fedora = (band: string) => (
  <g>
    <ellipse cx="60" cy="38" rx="34" ry="7" fill="#24163a" />
    <path d="M38 38 q2 -22 22 -22 q20 0 22 22 z" fill="#2e1d4a" />
    <rect x="38.5" y="31" width="43" height="6" fill={band} />
  </g>
);

const LOOKS: Record<RoleId, Look> = {
  villager: {
    body: '#f6c47e',
    shade: '#d99a52',
    eyes: 'round',
    back: <path d="M36 44 q24 -22 48 0 q-24 -6 -48 0z" fill="#8a5a3c" />,
    front: lantern,
  },
  mafia: {
    body: '#ff5470',
    shade: '#c8304f',
    eyes: 'sly',
    back: fedora('#ff5470'),
    front: <path d="M44 88 l16 10 l16 -10 l-4 14 h-24z" fill="#2e1d4a" />,
  },
  godfather: {
    body: '#c23a5c',
    shade: '#8e2342',
    eyes: 'heavy',
    back: fedora('#ffc857'),
    front: (
      <g>
        <path d="M44 88 l16 10 l16 -10 l-4 14 h-24z" fill="#2e1d4a" />
        <path d="M74 86 v10" stroke="#3fae6a" strokeWidth="2.5" />
        <circle cx="74" cy="84" r="5" fill="#ff3355" />
        <circle cx="74" cy="84" r="2" fill="#c21f3c" />
      </g>
    ),
  },
  roleblocker: {
    body: '#8d97b8',
    shade: '#626d93',
    eyes: 'sly',
    front: (
      <g transform="translate(92 66)">
        <rect x="-9" y="-6" width="18" height="20" rx="8" fill="#b6bfdc" />
        {[-7, -2.5, 2, 6.5].map((x) => (
          <rect key={x} x={x - 2} y="-16" width="4.5" height="13" rx="2.25" fill="#b6bfdc" />
        ))}
        <rect x="-6" y="2" width="12" height="9" rx="2" fill="#ffc857" />
        <path d="M-3.5 2 v-3 q3.5 -5 7 0 v3" stroke="#ffc857" strokeWidth="2" fill="none" />
      </g>
    ),
  },
  doctor: {
    body: '#5ee6b0',
    shade: '#2fb886',
    eyes: 'round',
    back: (
      <g>
        <path d="M30 46 q30 -10 60 0" stroke="#eef1ff" strokeWidth="3" fill="none" />
        <circle cx="60" cy="40" r="7" fill="#dff7ff" stroke="#9adcf0" strokeWidth="2" />
      </g>
    ),
    front: (
      <g transform="translate(86 84)">
        <rect x="-11" y="-8" width="22" height="16" rx="4" fill="#eef1ff" />
        <path d="M-5 -10 q5 -5 10 0" stroke="#eef1ff" strokeWidth="2.5" fill="none" />
        <path d="M0 -4 v8 M-4 0 h8" stroke="#ff5470" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    ),
  },
  detective: {
    body: '#ffb547',
    shade: '#d6862a',
    eyes: 'squint',
    back: (
      <g>
        <path d="M34 44 q26 -28 52 0z" fill="#7a4e2c" />
        <rect x="34" y="40" width="52" height="5" rx="2.5" fill="#5c3a20" />
      </g>
    ),
    front: (
      <g transform="translate(88 78)">
        <path d="M-5 5 l-8 10" stroke="#5c3a20" strokeWidth="4" strokeLinecap="round" />
        <circle r="9" fill="#bfe8ff" opacity="0.55" stroke="#eef1ff" strokeWidth="3" />
        <path d="M-3 -4 q2 -2 5 -1" stroke="#fff" strokeWidth="1.5" fill="none" />
      </g>
    ),
  },
  bodyguard: {
    body: '#5a8cff',
    shade: '#3561d6',
    eyes: 'shades',
    front: (
      <g transform="translate(88 82)">
        <path d="M0 -14 l12 5 v8 q0 10 -12 16 q-12 -6 -12 -16 v-8z" fill="#c9d6ff" />
        <path d="M0 -9 l7 3 v5 q0 6 -7 10 q-7 -4 -7 -10 v-5z" fill="#5a8cff" />
      </g>
    ),
  },
  lover: {
    body: '#ff8fb8',
    shade: '#e05c8f',
    eyes: 'dreamy',
    back: <path d="M60 30 c-6 -10 -20 -6 -18 4 c2 8 18 14 18 14 s16 -6 18 -14 c2 -10 -12 -14 -18 -4z" fill="#ff3d7f" opacity="0.35" />,
    front: (
      <g>
        <path d="M86 92 v-12" stroke="#3fae6a" strokeWidth="2.5" />
        <circle cx="86" cy="78" r="6" fill="#ff3355" />
        <circle cx="86" cy="78" r="2.5" fill="#c21f3c" />
      </g>
    ),
  },
  vigilante: {
    body: '#2ec4b6',
    shade: '#14918a',
    eyes: 'mask',
    front: (
      <g transform="translate(88 80)">
        <path d="M-12 -6 h24" stroke="#5c3a20" strokeWidth="4" strokeLinecap="round" />
        <path d="M0 -6 v18" stroke="#5c3a20" strokeWidth="4" strokeLinecap="round" />
        <path d="M-12 -6 q12 10 24 0" stroke="#eef1ff" strokeWidth="1.5" fill="none" />
      </g>
    ),
  },
  mayor: {
    body: '#6b7dff',
    shade: '#4457d6',
    eyes: 'round',
    back: (
      <g>
        <rect x="44" y="12" width="32" height="28" rx="3" fill="#24163a" />
        <ellipse cx="60" cy="40" rx="26" ry="5" fill="#24163a" />
        <rect x="44" y="32" width="32" height="5" fill="#ffc857" />
      </g>
    ),
    front: <path d="M36 74 l44 26" stroke="#ffc857" strokeWidth="7" strokeLinecap="round" />,
  },
  serialKiller: {
    body: '#9b5cff',
    shade: '#6a34c9',
    eyes: 'glow',
    back: <path d="M24 78 q0 -52 36 -52 q36 0 36 52 q-10 -30 -36 -30 q-26 0 -36 30z" fill="#2b1a4f" />,
    front: (
      <g transform="translate(90 84) rotate(-30)">
        <rect x="-2" y="0" width="4" height="9" rx="2" fill="#3b2a4a" />
        <path d="M-3 0 l3 -16 l3 16z" fill="#dfe6ff" />
      </g>
    ),
  },
  jester: {
    body: '#a86bff',
    shade: '#7a3ee0',
    eyes: 'side',
    back: (
      <g>
        <path d="M34 44 q-12 -24 -24 -10 q14 -2 24 10z" fill="#ffc857" />
        <path d="M86 44 q12 -24 24 -10 q-14 -2 -24 10z" fill="#ff5470" />
        <path d="M34 44 q26 -36 52 0z" fill="#7a3ee0" />
        <circle cx="10" cy="34" r="4" fill="#ffc857" />
        <circle cx="110" cy="34" r="4" fill="#ffc857" />
      </g>
    ),
  },
};

const wolfEars = (color: string) => (
  <g fill={color}>
    <path d="M36 50 l2 -26 l18 16z" />
    <path d="M84 50 l-2 -26 l-18 16z" />
  </g>
);

const snout = (color: string) => (
  <g>
    <ellipse cx="60" cy="80" rx="12" ry="8" fill={color} />
    <ellipse cx="60" cy="76" rx="4" ry="3" fill="#24163a" />
  </g>
);

function werewolfLook(role: RoleId, look: Look): Look {
  switch (role) {
    case 'mafia':
      return { body: '#8a93b8', shade: '#5f6890', eyes: 'sly', wolf: true };
    case 'godfather':
      return {
        body: '#6f7aa6',
        shade: '#4c5580',
        eyes: 'heavy',
        wolf: true,
        back: <path d="M46 26 l4 -10 l6 7 l4 -10 l4 10 l6 -7 l4 10z" fill="#ffc857" />,
      };
    case 'serialKiller':
      return { body: '#9b5cff', shade: '#6a34c9', eyes: 'glow', wolf: true };
    case 'roleblocker':
      return {
        ...look,
        back: (
          <g>
            <ellipse cx="60" cy="40" rx="32" ry="6" fill="#2e1d4a" />
            <path d="M42 40 l22 -34 l14 34z" fill="#3a2560" />
          </g>
        ),
        front: (
          <g transform="translate(90 80)">
            <path d="M-12 12 l20 -24" stroke="#7a4e2c" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="9" cy="-13" r="4" fill="#b38cff" />
          </g>
        ),
      };
    case 'doctor':
      return {
        ...look,
        back: undefined,
        front: (
          <g transform="translate(88 82)">
            <circle r="12" fill="#5ee6b0" opacity="0.25" />
            <path d="M-4 -12 h8 v6 l6 10 q2 8 -6 8 h-8 q-8 0 -6 -8 l6 -10z" fill="#dff7ff" />
            <path d="M-6 2 h12 l2 4 q0 4 -4 4 h-8 q-4 0 -4 -4z" fill="#3ee0c5" />
          </g>
        ),
      };
    case 'detective':
      return {
        ...look,
        back: (
          <g>
            <path d="M32 46 q28 -34 56 0z" fill="#4b2f7a" />
            <circle cx="60" cy="24" r="3" fill="#ffc857" />
          </g>
        ),
        front: (
          <g transform="translate(88 84)">
            <circle r="15" fill="#b38cff" opacity="0.25" />
            <circle cy="-2" r="10" fill="#c9b6ff" opacity="0.85" />
            <path d="M-4 -6 q3 -3 7 -2" stroke="#fff" strokeWidth="1.5" fill="none" />
            <rect x="-9" y="7" width="18" height="5" rx="2" fill="#7a4e2c" />
          </g>
        ),
      };
    case 'bodyguard':
      return { ...look, eyes: 'round', back: <path d="M34 46 q26 -34 52 0 l-4 2 q-22 -26 -44 0z" fill="#c9d6ff" /> };
    case 'vigilante':
      return {
        ...look,
        eyes: 'squint',
        front: (
          <g transform="translate(90 80)">
            <path d="M-4 -16 q14 16 0 32" stroke="#7a4e2c" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M-4 -16 v32" stroke="#eef1ff" strokeWidth="1" />
            <path d="M-12 0 h14 l-3 -3 m3 3 l-3 3" stroke="#dfe6ff" strokeWidth="2" fill="none" />
          </g>
        ),
      };
    case 'mayor':
      return {
        ...look,
        back: undefined,
        front: (
          <g>
            <path d="M46 84 q14 26 28 0 q-14 8 -28 0z" fill="#eef1ff" />
            <path d="M92 50 v52" stroke="#7a4e2c" strokeWidth="4" strokeLinecap="round" />
            <circle cx="92" cy="48" r="5" fill="#5ee6b0" />
          </g>
        ),
      };
    default:
      return look;
  }
}

function EyesArt({ kind, shade }: { kind: Eyes; shade: string }) {
  const pupils = (dx = 0, dy = 0) => (
    <>
      <circle cx={49 + dx} cy={62 + dy} r="4.2" fill="#1b1033" />
      <circle cx={71 + dx} cy={62 + dy} r="4.2" fill="#1b1033" />
      <circle cx={50.5 + dx} cy={60.5 + dy} r="1.4" fill="#fff" />
      <circle cx={72.5 + dx} cy={60.5 + dy} r="1.4" fill="#fff" />
    </>
  );
  const whites = (
    <>
      <circle cx="49" cy="62" r="8.5" fill="#fff" />
      <circle cx="71" cy="62" r="8.5" fill="#fff" />
    </>
  );
  const lids = (y: number) => (
    <>
      <path d={`M40 ${y} a9 9 0 0 1 18 0z`} fill={shade} />
      <path d={`M62 ${y} a9 9 0 0 1 18 0z`} fill={shade} />
    </>
  );

  switch (kind) {
    case 'sly':
      return (
        <g>
          {whites}
          {pupils(2, 1)}
          {lids(61)}
        </g>
      );
    case 'heavy':
      return (
        <g>
          {whites}
          {pupils(0, 2)}
          {lids(63)}
        </g>
      );
    case 'squint':
      return (
        <g>
          <circle cx="49" cy="62" r="8.5" fill="#fff" />
          <circle cx="71" cy="62" r="6" fill="#fff" />
          <circle cx="49" cy="62" r="4.2" fill="#1b1033" />
          <circle cx="71" cy="62" r="3" fill="#1b1033" />
          <path d="M64 55 l14 2" stroke={shade} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'dreamy':
      return (
        <g stroke="#1b1033" strokeWidth="2.6" fill="none" strokeLinecap="round">
          <path d="M42 63 q7 6 14 0" />
          <path d="M64 63 q7 6 14 0" />
        </g>
      );
    case 'glow':
      return (
        <g>
          <circle cx="49" cy="62" r="9" fill="#d6ff5a" opacity="0.25" />
          <circle cx="71" cy="62" r="9" fill="#d6ff5a" opacity="0.25" />
          <ellipse cx="49" cy="62" rx="5" ry="3" fill="#e9ff8a" />
          <ellipse cx="71" cy="62" rx="5" ry="3" fill="#e9ff8a" />
        </g>
      );
    case 'shades':
      return (
        <g>
          <rect x="38" y="56" width="20" height="12" rx="5" fill="#1b1033" />
          <rect x="62" y="56" width="20" height="12" rx="5" fill="#1b1033" />
          <path d="M58 60 h4" stroke="#1b1033" strokeWidth="2.5" />
          <path d="M42 59 l5 0" stroke="#fff" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
        </g>
      );
    case 'mask':
      return (
        <g>
          <rect x="34" y="54" width="52" height="16" rx="8" fill="#1b1033" />
          <circle cx="49" cy="62" r="5.5" fill="#fff" />
          <circle cx="71" cy="62" r="5.5" fill="#fff" />
          <circle cx="50" cy="62" r="2.8" fill="#1b1033" />
          <circle cx="72" cy="62" r="2.8" fill="#1b1033" />
        </g>
      );
    case 'side':
      return (
        <g>
          {whites}
          {pupils(4, 0)}
        </g>
      );
    default:
      return (
        <g>
          {whites}
          {pupils()}
        </g>
      );
  }
}

export function RoleArt({
  role,
  skin = 'mafia',
  dead = false,
  className = '',
}: {
  role: RoleId;
  skin?: SkinId;
  dead?: boolean;
  className?: string;
}) {
  const id = useId();
  const base = LOOKS[role];
  const look = skin === 'werewolf' ? werewolfLook(role, base) : base;

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      style={dead ? { filter: 'grayscale(1) brightness(0.8)', opacity: 0.55 } : undefined}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor={look.body} stopOpacity="0.45" />
          <stop offset="100%" stopColor={look.body} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={look.body} />
          <stop offset="100%" stopColor={look.shade} />
        </linearGradient>
      </defs>
      <circle cx="60" cy="62" r="54" fill={`url(#${id}-glow)`} />
      <ellipse cx="60" cy="108" rx="28" ry="5" fill="#000" opacity="0.25" />
      {look.wolf && wolfEars(look.shade)}
      <path
        d="M60 32 C82 32 92 52 92 74 C92 96 78 106 60 106 C42 106 28 96 28 74 C28 52 38 32 60 32 Z"
        fill={`url(#${id}-body)`}
      />
      <path d="M40 50 q8 -12 22 -13" stroke="#fff" strokeWidth="3" opacity="0.35" fill="none" strokeLinecap="round" />
      {look.back}
      <EyesArt kind={look.eyes} shade={look.shade} />
      {look.wolf && snout(look.body)}
      {look.front}
      {dead && (
        <g stroke="#1b1033" strokeWidth="3" strokeLinecap="round">
          <path d="M44 58 l10 8 M54 58 l-10 8 M66 58 l10 8 M76 58 l-10 8" />
        </g>
      )}
    </svg>
  );
}

export function CardBack({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden>
      <defs>
        <linearGradient id="cb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2453" />
          <stop offset="100%" stopColor="#0b1026" />
        </linearGradient>
      </defs>
      <rect width="120" height="160" rx="16" fill="url(#cb-sky)" />
      <circle cx="78" cy="48" r="22" fill="#ffe7a8" opacity="0.15" />
      <circle cx="78" cy="48" r="14" fill="#ffe7a8" />
      <circle cx="84" cy="44" r="12" fill="#1a2453" />
      {[
        [22, 30],
        [40, 18],
        [100, 80],
        [30, 64],
        [98, 22],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#eef1ff" opacity="0.8" />
      ))}
      <path d="M0 130 v-24 l14 -10 l14 10 v-16 h18 v12 l14 -14 l16 14 v-8 h16 v-12 l14 12 l14 -8 v36 z" fill="#070a1c" />
      <rect x="50" y="114" width="4" height="5" fill="#ffc857" />
      <rect x="20" y="118" width="4" height="5" fill="#ffc857" opacity="0.7" />
      <rect x="0" y="130" width="120" height="30" rx="0" fill="#070a1c" />
    </svg>
  );
}
