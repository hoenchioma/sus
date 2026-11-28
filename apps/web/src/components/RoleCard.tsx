import { teamOf, type RoleId } from '@sus/engine';
import { RoleArt } from '../art/RoleArt';
import type { RoleGuide } from '../lib/guide';
import type { Skin } from '../skins';
import { TEAM_TEXT } from './ui';

/** The face of a role card: who you are, what you can do, how you win, and your team if you have one. */
export function RoleFace({ role, skin, guide, teammates }: { role: RoleId; skin: Skin; guide: RoleGuide; teammates?: string[] }) {
  const team = teamOf(role);
  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-night-600 to-night-800 p-5 text-center">
      <RoleArt role={role} skin={skin.id} className="h-24 w-24" />
      <div className={`mt-1 text-xs font-black uppercase tracking-widest ${TEAM_TEXT[team]}`}>{skin.teams[team]}</div>
      <div className="text-2xl font-black leading-tight">{skin.roles[role].name}</div>
      <p className="mt-1 text-sm font-bold text-ink/90">{skin.roles[role].blurb}</p>
      {teammates && teammates.length > 0 && <p className="mt-2 text-sm font-bold text-mafia">Your team: {teammates.join(', ')}</p>}
      <GuideLines guide={guide} className="mt-3" />
    </div>
  );
}

export function GuideLines({ guide, className = '' }: { guide: RoleGuide; className?: string }) {
  return (
    <ul className={`w-full space-y-1.5 text-left text-xs leading-snug text-mist ${className}`}>
      <li>🏆 {guide.win}</li>
      <li>🌙 {guide.night}</li>
      <li>💡 {guide.tip}</li>
    </ul>
  );
}
