import type { ReactNode } from 'react';
import { CharacterSvg, type Look } from './RoleArt';

const GOLD = '#ffc857';
const NAWAB_CREST = '#1f9d6b';
const COMPANY_SEAL = '#c8304f';

const turban = (color: string, plume = false) => (
  <g>
    <path d="M36 46 q24 -26 48 0 q-24 -8 -48 0z" fill={color} />
    <path d="M38 44 q22 -6 44 0" stroke={GOLD} strokeWidth="2.5" fill="none" />
    <circle cx="60" cy="30" r="3.5" fill={GOLD} />
    {plume && <path d="M60 28 q6 -14 14 -16 q-4 8 -10 18z" fill="#eef1ff" />}
  </g>
);

const tricorn = (color: string) => (
  <g>
    <path d="M32 44 l28 -18 l28 18 q-28 -6 -56 0z" fill={color} />
    <path d="M34 43 q26 -5 52 0" stroke={GOLD} strokeWidth="2" fill="none" />
  </g>
);

const veil = (color: string) => <path d="M30 70 q0 -40 30 -40 q30 0 30 40 q-4 -26 -30 -28 q-26 2 -30 28z" fill={color} opacity="0.9" />;

const sword = (
  <g transform="translate(90 80) rotate(20)">
    <path d="M0 -24 q5 12 0 26" stroke="#dfe6ff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <rect x="-6" y="2" width="12" height="3" rx="1.5" fill={GOLD} />
    <rect x="-1.5" y="5" width="3" height="8" rx="1.5" fill="#5c3a20" />
  </g>
);

const lantern = (
  <g transform="translate(88 74)">
    <circle r="13" fill="#ffd36e" opacity="0.25" />
    <rect x="-6" y="-8" width="12" height="16" rx="4" fill="#ffd36e" />
    <rect x="-7" y="-11" width="14" height="4" rx="2" fill="#3b2a4a" />
  </g>
);

const letter = (
  <g transform="translate(88 84) rotate(-10)">
    <rect x="-9" y="-6" width="18" height="12" rx="2" fill="#fff6e0" />
    <path d="M-9 -6 l9 7 l9 -7" stroke="#c9a66b" strokeWidth="1.5" fill="none" />
    <circle cy="2" r="2.5" fill={COMPANY_SEAL} />
  </g>
);

const map = (
  <g transform="translate(88 84)">
    <rect x="-11" y="-8" width="22" height="16" rx="2" fill="#f3e2b8" />
    <path d="M-7 -3 q4 4 8 0 t6 4" stroke="#3d8cf0" strokeWidth="1.5" fill="none" />
    <circle cx="5" cy="-3" r="1.8" fill={COMPANY_SEAL} />
  </g>
);

const cannon = (
  <g transform="translate(88 88)">
    <rect x="-12" y="-5" width="22" height="8" rx="4" fill="#3b2a4a" transform="rotate(-15)" />
    <circle cx="-4" cy="5" r="5" fill="#7a4e2c" />
  </g>
);

const dagger = (
  <g transform="translate(92 86) rotate(-25)">
    <path d="M-2 -18 l2 -6 l2 6 v14 h-4z" fill="#dfe6ff" />
    <rect x="-6" y="-4" width="12" height="3" rx="1.5" fill={GOLD} />
    <rect x="-1.5" y="-1" width="3" height="8" rx="1.5" fill="#5c3a20" />
  </g>
);

const maskOnStick = (
  <g transform="translate(90 76)">
    <path d="M0 4 v18" stroke="#7a4e2c" strokeWidth="2.5" />
    <path d="M-12 -2 q12 -10 24 0 q-2 8 -12 8 q-10 0 -12 -8z" fill="#ff8fb8" />
    <circle cx="-5" cy="0" r="2.5" fill="#1b1033" />
    <circle cx="5" cy="0" r="2.5" fill="#1b1033" />
  </g>
);

const hood = (color: string) => <path d="M24 80 q0 -54 36 -54 q36 0 36 54 q-10 -32 -36 -32 q-26 0 -36 32z" fill={color} />;

const goblet = (
  <g transform="translate(90 84)">
    <path d="M-7 -10 h14 q0 10 -7 12 q-7 -2 -7 -12z" fill={GOLD} />
    <rect x="-1" y="2" width="2" height="7" fill={GOLD} />
    <rect x="-5" y="8" width="10" height="2.5" rx="1" fill={GOLD} />
    <circle cx="-14" cy="6" r="5" fill="#c9a66b" />
  </g>
);

const shield = (
  <g transform="translate(88 82)">
    <circle r="12" fill="#7a5a2c" stroke={GOLD} strokeWidth="2" />
    <circle r="3" fill={GOLD} />
    <path d="M-14 -24 v40" stroke="#5c3a20" strokeWidth="2.5" />
  </g>
);

const beads = (
  <g transform="translate(86 84)" fill="#c9a66b">
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <circle key={i} cx={Math.cos(i * 0.9) * 8} cy={Math.sin(i * 0.9) * 8} r="2.2" />
    ))}
  </g>
);

const deed = (
  <g transform="translate(88 84) rotate(8)">
    <rect x="-10" y="-8" width="20" height="16" rx="2" fill="#fff6e0" />
    <path d="M-6 -3 h12 M-6 1 h9" stroke="#9aa3d6" strokeWidth="1.5" />
    <circle cx="5" cy="5" r="3" fill={COMPANY_SEAL} />
  </g>
);

const watch = (
  <g transform="translate(88 84)">
    <circle r="8" fill={GOLD} />
    <circle r="6" fill="#fff6e0" />
    <path d="M0 0 v-4 M0 0 h3" stroke="#1b1033" strokeWidth="1.5" />
  </g>
);

const scroll = (
  <g transform="translate(88 84) rotate(-20)">
    <rect x="-12" y="-4" width="24" height="8" rx="4" fill="#fff6e0" />
    <rect x="-2" y="-5" width="4" height="10" fill={COMPANY_SEAL} />
  </g>
);

const scales = (
  <g transform="translate(88 80)" stroke={GOLD} strokeWidth="2" fill="none">
    <path d="M0 -12 v22 M-10 -8 h20" />
    <path d="M-14 -8 l4 8 h-8z M10 -8 l4 8 h-8z" fill={GOLD} />
  </g>
);

const crownTiny = <path d="M48 28 l4 -9 l8 6 l8 -6 l4 9z" fill={GOLD} />;
const wizardHat = (color: string) => <path d="M34 46 l26 -34 l26 34 q-26 -8 -52 0z" fill={color} />;
const helmet = <path d="M34 50 q26 -36 52 0 l-4 3 q-22 -24 -44 0z" fill="#c9d6ff" />;

function look(body: string, shade: string, eyes: Look['eyes'], back?: ReactNode, front?: ReactNode): Look {
  return { body, shade, eyes, back, front };
}

const FACES: Record<string, Look> = {
  // Polashi
  mirMadan: look('#2fbf71', '#1c8f52', 'squint', turban('#e9fff3', true), sword),
  mohonLal: look('#2ec4b6', '#14918a', 'round', turban('#d9f7f3'), lantern),
  siraj: look('#3fae6a', '#257a47', 'heavy', turban('#ffffff', true), <g fill="#fff">{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={46 + i * 7} cy={92} r="2.4" />)}</g>),
  lutfunnesa: look('#5ee6b0', '#2fb886', 'dreamy', veil('#b7f5dd'), letter),
  deBusi: look('#5a8cff', '#3561d6', 'round', tricorn('#24305e'), map),
  saintFrey: look('#7f8fb8', '#566390', 'sly', tricorn('#2a2f45'), cannon),
  mirJafar: look('#c23a5c', '#8e2342', 'sly', turban('#5c1830'), dagger),
  ghoseti: look('#e0479e', '#a52a73', 'heavy', veil('#ffb3dc'), maskOnStick),
  rayDurlov: look('#8e2342', '#5c1830', 'glow', hood('#2b1a4f')),
  umichad: look('#ff7a4d', '#d1532c', 'side', turban('#ffd0b8'), goblet),
  bahadurAliKhan: look('#8a9a3f', '#5f6d26', 'squint', helmet, shield),
  aminaBegum: look('#9fd8b8', '#6aa889', 'dreamy', veil('#eef1ff'), beads),
  raniBhabani: look('#eef1ff', '#b7c2e0', 'round', veil('#c6f2c4'), deed),
  jeanLaw: look('#8f9bff', '#6170d6', 'round', tricorn('#24305e'), watch),
  robertClive: look('#e8413d', '#b02320', 'sly', <path d="M36 48 q24 -22 48 0 q-24 -8 -48 0z" fill="#f4f4f4" />, scroll),
  jagatSeth: look('#d9822b', '#a85c16', 'heavy', turban('#ffe2b8'), scales),
  // Avalon
  merlin: look('#5a8cff', '#3561d6', 'squint', wizardHat('#2e3f8f')),
  percival: look('#2ec4b6', '#14918a', 'round', helmet, shield),
  servant: look('#f6c47e', '#d99a52', 'round', undefined, lantern),
  assassin: look('#c23a5c', '#8e2342', 'sly', hood('#3a1530'), dagger),
  morgana: look('#b04bd6', '#7a2aa0', 'heavy', crownTiny, maskOnStick),
  mordred: look('#6a34c9', '#4a1f95', 'glow', <g>{helmet}{crownTiny}</g>, sword),
  oberon: look('#8a93b8', '#5f6890', 'side', hood('#2b2f45')),
  minion: look('#ff5470', '#c8304f', 'sly', undefined, dagger),
};

const EVIL_FACES = new Set(['mirJafar', 'ghoseti', 'rayDurlov', 'umichad', 'robertClive', 'jagatSeth', 'assassin', 'morgana', 'mordred', 'oberon', 'minion']);
const POLASHI = new Set(['mirMadan', 'mohonLal', 'siraj', 'lutfunnesa', 'deBusi', 'saintFrey', 'mirJafar', 'ghoseti', 'rayDurlov', 'umichad', 'bahadurAliKhan', 'aminaBegum', 'raniBhabani', 'jeanLaw', 'robertClive', 'jagatSeth']);

/** A quest character; Polashi cards carry a side crest (green Nawab emblem or red Company seal). */
export function QuestArt({ card, className = '', crest = true }: { card: string; className?: string; crest?: boolean }) {
  const face = FACES[card] ?? FACES.servant!;
  const showCrest = crest && POLASHI.has(card);
  return <CharacterSvg look={face} className={className} crest={showCrest ? (EVIL_FACES.has(card) ? COMPANY_SEAL : NAWAB_CREST) : undefined} />;
}

/** Neutral seat avatar that never hints at a role. */
export function SeatAvatar({ name, className = '' }: { name: string; className?: string }) {
  return (
    <div className={`grid place-items-center rounded-full bg-night-600 font-black ${className}`} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
