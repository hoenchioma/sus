import { teamOf, type Announcement } from '@sus/engine';
import { RoleArt } from '../art/RoleArt';
import type { Skin, SkinId } from '../skins';
import { Card, TEAM_TEXT } from './ui';

export function AnnouncementCard({
  announcement,
  skin,
  skinId,
  big = false,
}: {
  announcement: Announcement;
  skin: Skin;
  skinId: SkinId;
  big?: boolean;
}) {
  const a = announcement;
  return (
    <Card className={`w-full text-center animate-rise ${big ? 'max-w-3xl !p-10' : 'max-w-sm'}`}>
      <div className={`font-black ${big ? 'text-6xl' : 'text-2xl'}`}>{a.title}</div>
      <ul className={`mt-4 flex flex-col items-center gap-3 ${big ? 'text-3xl' : ''}`}>
        {a.entries.map((e, i) => (
          <li key={i} className="flex items-center gap-3">
            {e.role && <RoleArt role={e.role} skin={skinId} dead={a.kind !== 'mayor'} className={big ? 'h-24 w-24' : 'h-12 w-12'} />}
            <div className="text-left">
              {e.note === 'partner' ? (
                <span className="font-bold text-rose">💗 {e.name} spent the night with the {skin.roles.lover.name} and can't vote today</span>
              ) : e.note === 'code' ? (
                <span className="text-4xl font-black tracking-widest">{e.text}</span>
              ) : (
                <>
                  <span className="font-extrabold">{e.name}</span>
                  {e.note === 'heartbreak' && <span className="text-mist"> died of heartbreak</span>}
                  {e.role && <span className={`block font-bold ${TEAM_TEXT[teamOf(e.role)]}`}>{skin.roles[e.role].name}</span>}
                  {e.team && <span className={`block font-bold ${TEAM_TEXT[e.team]}`}>{skin.teams[e.team]}</span>}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!big && <p className="mt-4 text-xs text-haze">Tap to close</p>}
    </Card>
  );
}
