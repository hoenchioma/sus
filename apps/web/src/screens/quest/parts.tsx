import { useMemo } from 'react';
import { quest } from '@sus/engine';
import { QuestArt } from '../../art/QuestArt';
import { Card, Chip } from '../../components/ui';
import { useStored } from '../../lib/storage';
import { cardName, formatNumber, questTerms, uiText, type Lang, type QuestSkinId, type QuestTerms, type UiText } from '../../skins/quest';

export interface QuestText {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: UiText;
  terms: QuestTerms;
  num: (n: number) => string;
  font: string;
}

export function useQuestText(skin: QuestSkinId): QuestText {
  const [stored, setLang] = useStored<Lang>('sus.lang', 'bn');
  const lang: Lang = skin === 'polashi' ? stored : 'en';
  return useMemo(
    () => ({
      lang,
      setLang,
      t: uiText(skin, lang),
      terms: questTerms(skin, lang),
      num: (n: number) => formatNumber(n, lang),
      font: lang === 'bn' ? 'font-bangla' : '',
    }),
    [lang, setLang, skin],
  );
}

export function LangToggle({ text, skin }: { text: QuestText; skin: QuestSkinId }) {
  if (skin !== 'polashi') return null;
  return (
    <div className="flex gap-1 rounded-full bg-night-800 p-1">
      {(['bn', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => text.setLang(l)}
          className={`rounded-full px-3 py-1 text-sm font-extrabold ${text.lang === l ? 'bg-sky text-night-950' : 'text-mist'}`}
        >
          {l === 'bn' ? 'বাং' : 'EN'}
        </button>
      ))}
    </div>
  );
}

const SIDE_COLOR = { good: 'text-village', evil: 'text-mafia' } as const;

export function ChapterTrack({
  teams,
  doubleFail,
  results,
  chapter,
  text,
  big = false,
}: {
  teams: number[];
  doubleFail: boolean[];
  results: { winner: quest.Side }[];
  chapter: number;
  text: QuestText;
  big?: boolean;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {teams.map((size, i) => {
        const result = results[i];
        const current = i + 1 === chapter && !result;
        return (
          <div
            key={i}
            className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl ring-2 transition ${
              result?.winner === 'good'
                ? 'bg-village/25 ring-village'
                : result?.winner === 'evil'
                  ? 'bg-mafia/25 ring-mafia'
                  : current
                    ? 'bg-night-600 ring-sky'
                    : 'bg-night-800 ring-white/5'
            }`}
          >
            <span className={`font-black tabular-nums ${big ? 'text-[3vw]' : 'text-2xl'}`}>{text.num(size)}</span>
            {doubleFail[i] && <span className={`font-black text-sun ${big ? 'text-[1.4vw]' : 'text-[10px]'}`}>★ {text.t.twoNeeded}</span>}
            {result && <span className={`absolute -right-1 -top-1 ${big ? 'text-[2vw]' : 'text-lg'}`}>{result.winner === 'good' ? '🛡️' : '🗡️'}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function RejectionTrack({ count, text, big = false }: { count: number; text: QuestText; big?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-bold text-mist ${big ? 'text-[1.4vw]' : 'text-xs'}`}>{text.t.rejections}</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`rounded-full ${big ? 'h-[1.6vw] w-[1.6vw]' : 'h-3 w-3'} ${i <= count ? (i === 5 ? 'bg-mafia' : 'bg-sun') : 'bg-night-600'}`}
        />
      ))}
    </div>
  );
}

export function CharacterReveal({
  card,
  role,
  text,
  knows,
}: {
  card: string;
  role: quest.QuestRole;
  text: QuestText;
  knows?: { kind: string; players: { name: string; card?: string }[] };
}) {
  const side = quest.sideOf(role);
  return (
    <div className={`flex flex-col items-center text-center ${text.font}`}>
      <QuestArt card={card} className="h-32 w-32" />
      <div className={`mt-1 text-xs font-black uppercase tracking-widest ${SIDE_COLOR[side]}`}>{text.terms.sides[side]}</div>
      <div className="text-2xl font-black leading-tight">{cardName(card, text.lang)}</div>
      {quest.hasPower(role) && cardName(card, text.lang) !== text.terms.roleNames[role] && (
        <div className="text-sm font-bold text-mist">{text.terms.roleNames[role]}</div>
      )}
      <p className="mt-2 text-sm text-mist">{text.terms.powers[role]}</p>
      {knows && (
        <div className="mt-3 w-full rounded-2xl bg-night-800/80 p-3 text-left text-sm">
          {knows.kind === 'none' ? (
            <span className="text-mist">{text.t.knowNothing}</span>
          ) : (
            <>
              <div className="font-bold text-mist">{text.t.youKnow[knows.kind as 'evil' | 'merlinCandidates' | 'team']}</div>
              <div className="mt-1 font-extrabold">{knows.players.map((p) => p.name + (p.card ? ` (${cardName(p.card, text.lang)})` : '')).join(', ') || '—'}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function QuestSettingsPanel({
  players,
  rules,
  preset,
  skin,
  text,
  onChange,
  extra,
}: {
  players: number;
  rules: quest.QuestRuleChoices;
  preset: quest.QuestPresetId;
  skin: QuestSkinId;
  text: QuestText;
  onChange: (patch: { rules?: quest.QuestRuleChoices; preset?: quest.QuestPresetId; skin?: QuestSkinId }) => void;
  extra?: React.ReactNode;
}) {
  const n = Math.max(quest.MIN_QUEST_PLAYERS, Math.min(quest.MAX_QUEST_PLAYERS, players));
  const resolved = quest.resolveQuestRules(rules, n);
  const balance = quest.questBalance(rules, n);
  const { t } = text;
  const powers = ['percival', 'morgana', 'mordred', 'oberon', 'lady'] as const;
  const warningText: Record<string, string> = { experimental: t.experimental, ladySmall: t.ladySmall, oberonSmall: t.oberonSmall };

  return (
    <div className={`flex flex-col gap-3 ${text.font}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full bg-night-800 p-1">
          {(['polashi', 'avalon'] as const).map((s) => (
            <Chip key={s} active={skin === s} onClick={() => onChange({ skin: s })}>
              {questTerms(s, text.lang).game}
            </Chip>
          ))}
        </div>
        <LangToggle text={text} skin={skin} />
      </div>

      <Card className="!p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-black">{text.terms.sides.good} ⇄ {text.terms.sides.evil}</span>
          <span className="text-sm font-bold tabular-nums text-mist">
            {text.num(quest.tableFor(n).good)} / {text.num(quest.tableFor(n).evil)}
          </span>
        </div>
        <div className="relative mt-2 h-3 rounded-full bg-gradient-to-r from-mafia via-sun to-village">
          <span
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-500"
            style={{ left: `${Math.max(4, Math.min(96, 50 + balance.score * 6))}%` }}
          />
        </div>
        {balance.warnings.map((w) => (
          <p key={w} className="mt-2 text-sm text-sun">
            ⚠ {warningText[w] ?? w}
          </p>
        ))}
      </Card>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(quest.QUEST_PRESETS) as quest.QuestPresetId[]).map((id) => (
          <Chip key={id} active={preset === id} onClick={() => onChange({ preset: id, rules: { ...quest.QUEST_PRESETS[id].rules } })}>
            {t.preset[id]}
          </Chip>
        ))}
      </div>

      <div className="text-xs font-black uppercase tracking-widest text-haze">{t.powers}</div>
      <ul className="flex flex-col gap-2">
        {powers.map((id) => {
          const status = resolved.status[id]!;
          const on = resolved.values[id] === true;
          const locked = status.kind === 'locked';
          const role = id === 'lady' ? null : (id as quest.QuestRole);
          return (
            <li key={id}>
              <button
                disabled={locked}
                onClick={() => onChange({ rules: { ...rules, [id]: !on } })}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 pr-4 text-left ring-1 transition disabled:opacity-45 ${on ? 'bg-night-600 ring-sky' : 'bg-night-800/70 ring-white/5'}`}
              >
                {role ? (
                  <QuestArt card={skin === 'polashi' ? { percival: 'mohonLal', morgana: 'ghoseti', mordred: 'rayDurlov', oberon: 'umichad' }[id as 'percival'] : role} className="h-12 w-12 shrink-0" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center text-3xl">🕵️</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{role ? text.terms.roleNames[role] : text.terms.spy}</div>
                  <div className="text-xs text-mist">{locked ? `🔒 ${text.lang === 'bn' ? t.locked : status.reason}` : role ? text.terms.powers[role] : `${text.terms.spy}: ${t.spyPick}`}</div>
                </div>
                <span className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${on ? 'bg-sky' : 'bg-night-600'}`}>
                  <span className={`block h-5 w-5 rounded-full bg-ink transition ${on ? 'translate-x-5' : ''}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <label className="flex items-center justify-between rounded-2xl bg-night-800/70 p-4 font-extrabold">
        {t.rule.anonymousVotes}
        <input type="checkbox" checked={!!rules.anonymousVotes} onChange={(e) => onChange({ rules: { ...rules, anonymousVotes: e.target.checked } })} />
      </label>
      {extra}
    </div>
  );
}

export function SeatList({
  players,
  commander,
  team,
  spy,
  pastSpies = [],
  selected,
  onToggle,
  text,
}: {
  players: { id: string; name: string; absent?: boolean }[];
  commander?: string;
  team?: string[] | null;
  spy?: string | null;
  pastSpies?: string[];
  selected?: string[];
  onToggle?: (id: string) => void;
  text: QuestText;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {players.map((p) => {
        const isSelected = selected?.includes(p.id);
        return (
          <li key={p.id}>
            <button
              disabled={!onToggle}
              onClick={() => onToggle?.(p.id)}
              className={`flex min-h-14 w-full items-center gap-2 rounded-2xl px-3 text-left font-extrabold ring-1 transition active:scale-95 disabled:active:scale-100 ${
                isSelected ? 'bg-sky text-night-950 ring-sky' : team?.includes(p.id) ? 'bg-night-600 ring-sun' : 'bg-night-800 ring-white/5'
              } ${p.absent ? 'opacity-50' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {commander === p.id && <span title={text.terms.commander}>👑</span>}
              {team?.includes(p.id) && !onToggle && <span title={text.t.team}>⚔️</span>}
              {spy === p.id && <span title={text.terms.spy}>🕵️</span>}
              {spy !== p.id && pastSpies.includes(p.id) && <span className="opacity-50">🕵️</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
