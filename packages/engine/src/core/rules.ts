export type RuleValue = string | boolean | number;

export interface RuleOption<V extends RuleValue = RuleValue> {
  value: V;
  label: string;
}

export interface RuleDef<Ctx, V extends RuleValue = RuleValue> {
  id: string;
  label: string;
  description?: string;
  options: RuleOption<V>[];
  default: V;
  /** Hidden from the settings screen (and forced to `lockedValue ?? default`) when false. */
  appliesIf?: (ctx: Ctx) => boolean;
  /** Returns a reason when the rule can't be changed in this context. */
  lockedUnless?: (ctx: Ctx) => string | null;
  /** Value enforced while locked or hidden. */
  lockedValue?: V;
}

export type RuleStatus =
  | { kind: 'normal' }
  | { kind: 'hidden' }
  | { kind: 'locked'; reason: string };

export interface ResolvedRules {
  values: Record<string, RuleValue>;
  status: Record<string, RuleStatus>;
}

/**
 * Applies visibility and locks in definition order, so a rule can depend on
 * rules declared before it (e.g. ghost vote → dead can talk → death reveal).
 */
export function resolveRules<Ctx extends { rules: Record<string, RuleValue> }>(
  defs: RuleDef<Ctx>[],
  chosen: Record<string, RuleValue>,
  makeCtx: (values: Record<string, RuleValue>) => Ctx,
): ResolvedRules {
  const values: Record<string, RuleValue> = {};
  const status: Record<string, RuleStatus> = {};

  for (const def of defs) values[def.id] = chosen[def.id] ?? def.default;

  for (const def of defs) {
    const ctx = makeCtx(values);
    const forced = def.lockedValue ?? def.default;
    if (def.appliesIf && !def.appliesIf(ctx)) {
      status[def.id] = { kind: 'hidden' };
      values[def.id] = forced;
      continue;
    }
    const reason = def.lockedUnless?.(ctx) ?? null;
    if (reason) {
      status[def.id] = { kind: 'locked', reason };
      values[def.id] = forced;
      continue;
    }
    status[def.id] = { kind: 'normal' };
  }

  return { values, status };
}
