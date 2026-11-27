import { useMemo, useState } from 'react';
import {
  PRESETS,
  ROLE_IDS,
  ROLES,
  RULE_DEFS,
  balance,
  dealRoles,
  resolveMafiaRules,
  rolesList,
  setupProblems,
  suggestFixes,
  suggestedRoles,
  suggestedRules,
  teamOf,
  type Band,
  type PresetId,
  type RoleCounts,
  type RoleId,
  type Setup,
  type ThreatLevel,
} from '@sus/engine';
import type { Dispatch, SetStateAction } from 'react';
import type { Draft, Group } from '../App';
import { RoleArt } from '../art/RoleArt';
import { Button, Card, Chip, Screen, TEAM_TEXT } from '../components/ui';
import { SKINS, type Skin, type SkinId } from '../skins';
import { FullscreenButton } from '../components/FullscreenButton';

const STEPS = ['Players', 'Roles', 'Rules', 'Deal'] as const;

export function SetupScreen({
  draft,
  setDraft,
  groups,
  setGroups,
  onBack,
  onStart,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  groups: Group[];
  setGroups: Dispatch<SetStateAction<Group[]>>;
  onBack: () => void;
  onStart: (setup: Setup, revealed: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const total = rolesList(draft.counts).length;
  const problems = setupProblems(draft.counts);
  const canNext = [
    draft.names.length >= 5,
    total === draft.names.length && problems.length === 0,
    true,
    draft.deal === 'app' || draft.names.every((_, i) => draft.assigned[i]),
  ][step];

  const start = () => {
    const players = draft.names.map((name) => ({ id: crypto.randomUUID(), name }));
    const roles =
      draft.deal === 'app'
        ? dealRoles(players, draft.counts)
        : Object.fromEntries(players.map((p, i) => [p.id, draft.assigned[i]!]));
    onStart({ players, roles, rules: draft.rules }, draft.deal === 'manual');
  };

  const next = () => {
    if (step === 0 && total !== draft.names.length) {
      patch({ counts: suggestedRoles(draft.names.length), rules: { ...draft.rules, ...suggestedRules(draft.names.length) }, assigned: {} });
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else start();
  };

  return (
    <Screen>
      <header className="mb-5 flex items-center gap-3">
        <button className="h-10 w-10 rounded-full bg-night-700 text-xl" aria-label="Back" onClick={() => (step ? setStep(step - 1) : onBack())}>
          ‹
        </button>
        <div className="flex flex-1 gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s}
              disabled={i > step}
              onClick={() => setStep(i)}
              className={`flex-1 rounded-full py-1.5 text-xs font-extrabold transition ${i === step ? 'bg-sky text-night-950' : i < step ? 'bg-night-600 text-ink' : 'bg-night-800 text-haze'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <FullscreenButton />
      </header>

      <div className="flex-1 animate-rise" key={step}>
        {step === 0 && <Players draft={draft} patch={patch} groups={groups} setGroups={setGroups} />}
        {step === 1 && <Roles draft={draft} patch={patch} />}
        {step === 2 && <RulesStep draft={draft} patch={patch} />}
        {step === 3 && <Deal draft={draft} patch={patch} />}
      </div>

      <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-night-900 via-night-900/95 to-transparent pt-4">
        <Button className="h-14 w-full text-lg" disabled={!canNext} onClick={next}>
          {step === STEPS.length - 1 ? (draft.deal === 'app' ? 'Deal roles' : 'Start game') : 'Next'}
        </Button>
      </div>
    </Screen>
  );
}

export type Patch = (p: Partial<Draft>) => void;

function Players({ draft, patch, groups, setGroups }: { draft: Draft; patch: Patch; groups: Group[]; setGroups: Dispatch<SetStateAction<Group[]>> }) {
  const [name, setName] = useState('');
  const names = draft.names;
  const add = () => {
    const n = name.trim();
    if (!n || names.includes(n)) return;
    patch({ names: [...names, n] });
    setName('');
  };
  const move = (i: number, by: number) => {
    const next = [...names];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    patch({ names: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-black">Who's playing?</h1>
        <p className="text-mist">Add everyone except the host, in seating order.</p>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <Chip key={g.name} onClick={() => patch({ names: g.names })}>
              {g.name} · {g.names.length}
            </Chip>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          maxLength={20}
          className="min-h-12 flex-1 rounded-2xl bg-night-700 px-4 font-bold text-ink placeholder:text-haze outline-none ring-1 ring-white/10 focus:ring-sky"
        />
        <Button type="submit" disabled={!name.trim()}>
          Add
        </Button>
      </form>

      <ol className="flex flex-col gap-2">
        {names.map((n, i) => (
          <li key={n} className="flex items-center gap-3 rounded-2xl bg-night-700/60 px-4 py-2.5 ring-1 ring-white/5">
            <span className="w-6 text-sm font-black text-haze">{i + 1}</span>
            <span className="flex-1 font-bold">{n}</span>
            <button aria-label={`Move ${n} up`} className="h-8 w-8 rounded-full text-mist hover:bg-night-600" onClick={() => move(i, -1)}>
              ↑
            </button>
            <button aria-label={`Move ${n} down`} className="h-8 w-8 rounded-full text-mist hover:bg-night-600" onClick={() => move(i, 1)}>
              ↓
            </button>
            <button aria-label={`Remove ${n}`} className="h-8 w-8 rounded-full text-mafia hover:bg-night-600" onClick={() => patch({ names: names.filter((x) => x !== n) })}>
              ✕
            </button>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between text-sm">
        <span className={names.length >= 5 ? 'text-mist' : 'text-sun'}>
          {names.length} players{names.length < 5 ? ' · need at least 5' : ''}
        </span>
        {names.length >= 5 && (
          <button
            className="font-bold text-sky"
            onClick={() => {
              const label = prompt('Name this group', 'Friday crew');
              if (label) setGroups((gs) => [...gs.filter((g) => g.name !== label), { name: label, names }]);
            }}
          >
            Save group
          </button>
        )}
      </div>
    </div>
  );
}

const BAND_TEXT: Record<Band, { label: (teams: Skin['teams']) => string; color: string; pos: number }> = {
  'strongly-village': { label: (t) => `Strongly ${t.village}`, color: 'text-village', pos: 95 },
  'leans-village': { label: (t) => `Leans ${t.village}`, color: 'text-village', pos: 75 },
  balanced: { label: () => 'Balanced', color: 'text-sun', pos: 50 },
  'leans-mafia': { label: (t) => `Leans ${t.mafia}`, color: 'text-mafia', pos: 25 },
  'strongly-mafia': { label: (t) => `Strongly ${t.mafia}`, color: 'text-mafia', pos: 5 },
};

const THREAT_TEXT: Record<ThreatLevel, string> = { none: '', medium: 'Medium', high: 'High', 'very-high': 'Very high' };

export function Roles({ draft, patch }: { draft: Draft; patch: Patch }) {
  const skin = SKINS[draft.skin];
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [undo, setUndo] = useState<RoleCounts | null>(null);
  const counts = draft.counts;
  const b = balance(counts, draft.rules);
  const fixes = suggestFixes(counts, draft.rules);
  const total = rolesList(counts).length;
  const players = draft.names.length;
  const problems = setupProblems(counts);
  const hideComplex = PRESETS[draft.preset].hideComplexRoles;
  const visible = ROLE_IDS.filter((r) => !(hideComplex && ROLES[r].complex) || (counts[r] ?? 0) > 0);
  const band = BAND_TEXT[b.band];
  const meterPos = Math.max(4, Math.min(96, 50 + b.score * 4));

  const set = (role: RoleId, n: number) => {
    setUndo(null);
    patch({ counts: { ...counts, [role]: Math.max(0, n) }, assigned: {} });
  };
  const roleName = (r: RoleId) => skin.roles[r].name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black">Roles</h1>
          <p className={total === players ? 'text-mist' : 'text-sun'}>
            {total} / {players} roles
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-night-800 p-1">
          {(Object.keys(SKINS) as SkinId[]).map((s) => (
            <Chip key={s} active={draft.skin === s} onClick={() => patch({ skin: s })}>
              {SKINS[s].label}
            </Chip>
          ))}
        </div>
      </div>

      <Card className="!p-4">
        <button className="w-full text-left" onClick={() => setShowBreakdown(!showBreakdown)} aria-expanded={showBreakdown}>
          <div className="flex items-baseline justify-between">
            <span className={`text-lg font-black ${band.color}`}>{band.label(skin.teams)}</span>
            <span className="font-black tabular-nums text-mist">
              {b.score > 0 ? '+' : ''}
              {b.score}
            </span>
          </div>
          <div className="relative mt-2 h-3 rounded-full bg-gradient-to-r from-mafia via-sun to-village">
            <span
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-all duration-500"
              style={{ left: `${meterPos}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-haze">
            <span>{skin.teams.mafia}</span>
            <span>{skin.teams.village}</span>
          </div>
        </button>

        {showBreakdown && (
          <ul className="mt-3 space-y-1 border-t border-white/5 pt-3 text-sm">
            {b.breakdown.map((item) => (
              <li key={item.label} className="flex justify-between text-mist">
                <span>{(ROLE_IDS as string[]).includes(item.label) ? `${counts[item.label as RoleId]}× ${roleName(item.label as RoleId)}` : item.label}</span>
                <span className="tabular-nums">{item.points > 0 ? `+${item.points}` : item.points}</span>
              </li>
            ))}
          </ul>
        )}

        {b.neutralThreat !== 'none' && (
          <p className="mt-3 text-sm font-bold text-neutral">Neutral threat: {THREAT_TEXT[b.neutralThreat]}</p>
        )}
        {b.warnings.map((w) => (
          <p key={w} className="mt-2 text-sm text-sun">
            ⚠ {w}
          </p>
        ))}
        {(fixes.length > 0 || undo) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {fixes.map((f) => (
              <Chip
                key={`${f.from}-${f.to}`}
                onClick={() => {
                  setUndo(counts);
                  patch({ counts: { ...counts, [f.from]: (counts[f.from] ?? 0) - 1, [f.to]: (counts[f.to] ?? 0) + 1 }, assigned: {} });
                }}
              >
                Swap {roleName(f.from)} → {roleName(f.to)}
              </Chip>
            ))}
            {undo && (
              <Chip
                onClick={() => {
                  patch({ counts: undo });
                  setUndo(null);
                }}
              >
                ↶ Undo
              </Chip>
            )}
          </div>
        )}
      </Card>

      {problems.filter((p) => !p.startsWith('Needs at least 5')).map((p) => (
        <p key={p} className="text-sm font-bold text-mafia">
          {p}
        </p>
      ))}

      <button className="self-start text-sm font-bold text-sky" onClick={() => patch({ counts: suggestedRoles(players), rules: { ...draft.rules, ...suggestedRules(players) }, assigned: {} })}>
        Use suggested mix for {players}
        {suggestedRules(players).noKillNight1 && ' (turns on "No kills on night 1")'}
      </button>

      <ul className="flex flex-col gap-2">
        {visible.map((role) => {
          const n = counts[role] ?? 0;
          const max = ROLES[role].unique ? 1 : players;
          return (
            <li key={role} className={`flex items-center gap-3 rounded-2xl p-2 pr-3 ring-1 transition ${n ? 'bg-night-700/80 ring-white/10' : 'bg-night-800/50 ring-white/[0.03]'}`}>
              <RoleArt role={role} skin={draft.skin} className="h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold">{roleName(role)}</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${TEAM_TEXT[teamOf(role)]}`}>{skin.teams[teamOf(role)]}</span>
                </div>
                <p className="text-xs leading-snug text-mist">{skin.roles[role].blurb}</p>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label={`Fewer ${roleName(role)}`} disabled={!n} onClick={() => set(role, n - 1)} className="h-9 w-9 rounded-full bg-night-600 font-black disabled:opacity-30">
                  −
                </button>
                <span className="w-5 text-center font-black tabular-nums">{n}</span>
                <button aria-label={`More ${roleName(role)}`} disabled={n >= max} onClick={() => set(role, n + 1)} className="h-9 w-9 rounded-full bg-night-600 font-black disabled:opacity-30">
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RulesStep({ draft, patch }: { draft: Draft; patch: Patch }) {
  const resolved = useMemo(() => resolveMafiaRules(draft.rules, draft.counts), [draft.rules, draft.counts]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-black">House rules</h1>
        <p className="text-mist">Start from a preset, then tweak.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <Chip key={id} active={draft.preset === id} onClick={() => patch({ preset: id, rules: { ...PRESETS[id].rules } })}>
            {PRESETS[id].label}
          </Chip>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {RULE_DEFS.map((def) => {
          const status = resolved.status[def.id]!;
          if (status.kind === 'hidden') return null;
          const locked = status.kind === 'locked';
          return (
            <li key={def.id} className={`rounded-2xl bg-night-700/60 p-4 ring-1 ring-white/5 ${locked ? 'opacity-55' : ''}`}>
              <div className="font-extrabold">{def.label}</div>
              {def.description && <p className="mt-0.5 text-xs text-mist">{def.description}</p>}
              {locked && <p className="mt-0.5 text-xs font-bold text-sun">🔒 {status.reason}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {def.options.map((o) => (
                  <Chip
                    key={String(o.value)}
                    disabled={locked}
                    active={resolved.values[def.id] === o.value}
                    onClick={() => patch({ rules: { ...draft.rules, [def.id]: o.value } })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Deal({ draft, patch }: { draft: Draft; patch: Patch }) {
  const skin = SKINS[draft.skin];
  const pool = rolesList(draft.counts);
  const usedCount = (role: RoleId) => Object.values(draft.assigned).filter((r) => r === role).length;
  const left = (role: RoleId) => pool.filter((r) => r === role).length - usedCount(role);
  const distinct = [...new Set(pool)];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-black">Deal the roles</h1>
        <p className="text-mist">How will everyone get their secret role?</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['app', '📱', 'Pass this phone', 'The app deals at random. Each player peeks in turn.'],
            ['manual', '🃏', 'We dealt cards', 'Tell the app who got which role.'],
          ] as const
        ).map(([id, icon, title, text]) => (
          <button
            key={id}
            onClick={() => patch({ deal: id })}
            className={`rounded-card p-4 text-left ring-2 transition ${draft.deal === id ? 'bg-night-600 ring-sky' : 'bg-night-800 ring-transparent'}`}
          >
            <div className="text-3xl">{icon}</div>
            <div className="mt-2 font-extrabold">{title}</div>
            <div className="text-xs text-mist">{text}</div>
          </button>
        ))}
      </div>

      {draft.deal === 'manual' && (
        <ul className="flex flex-col gap-2">
          {draft.names.map((name, i) => (
            <li key={name} className="rounded-2xl bg-night-700/60 p-3 ring-1 ring-white/5">
              <div className="mb-2 font-extrabold">{name}</div>
              <div className="flex flex-wrap gap-1.5">
                {distinct.map((role) => {
                  const mine = draft.assigned[i] === role;
                  return (
                    <Chip
                      key={role}
                      active={mine}
                      disabled={!mine && left(role) <= 0}
                      onClick={() => {
                        const assigned = { ...draft.assigned };
                        if (mine) delete assigned[i];
                        else assigned[i] = role;
                        patch({ assigned });
                      }}
                    >
                      {skin.roles[role].name}
                    </Chip>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
