export type OgabasseyTransformRuleCapability = Readonly<{
  /** Authenticated provider evidence that the exact cookie-map rule is available. */
  authenticated: boolean;
  /** Account capability for the exact cookie-map Transform Rule expression. */
  supported: boolean;
  /** Explicit owner approval for the capability and its incremental plan cost. */
  approved: boolean;
  incrementalZonePlanCostUsd: string;
}>;

export function decimalToMinorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

export function validateTransformRuleCapability(
  capability: OgabasseyTransformRuleCapability | undefined
) {
  if (capability?.authenticated !== true || capability.supported !== true)
    return {
      ok: false as const,
      verdict: 'STOP' as const,
      reason: 'transform_rule_capability_unavailable',
    };
  if (capability.approved !== true)
    return {
      ok: false as const,
      verdict: 'STOP' as const,
      reason: 'transform_rule_capability_unapproved',
    };
  const incrementalZonePlanCost = decimalToMinorUnits(
    capability.incrementalZonePlanCostUsd
  );
  if (incrementalZonePlanCost === null)
    return {
      ok: false as const,
      verdict: 'NOT_PROVEN' as const,
      reason: 'transform_rule_zone_plan_cost_invalid',
    };
  return { ok: true as const, incrementalZonePlanCost };
}
