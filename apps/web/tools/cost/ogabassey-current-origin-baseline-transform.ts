import { createHash } from 'node:crypto';

declare const retrievedTransformRuleCapabilityBrand: unique symbol;

export type OgabasseyTransformRuleCapability = Readonly<{
  /** Account capability for the exact cookie-map Transform Rule expression. */
  supported: boolean;
  /** Explicit owner approval for the capability and its incremental plan cost. */
  approved: boolean;
  incrementalZonePlanCostUsd: string;
  providerCapabilitySha256: string;
  ownerApprovalSha256: string;
  readonly [retrievedTransformRuleCapabilityBrand]: true;
}>;

const retrievedCapabilities = new WeakSet<object>();

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function exactObject(
  value: unknown,
  expected: Readonly<Record<string, unknown>>
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = value as Record<string, unknown>;
  const keys = Object.keys(expected);
  return (
    Object.keys(actual).length === keys.length &&
    keys.every((key) => actual[key] === expected[key])
  );
}

/** Retrieves and binds provider capability and owner-approved cost receipts. */
export async function retrieveAuthenticatedTransformRuleCapability(
  fetchProviderCapability: () => Promise<string>,
  fetchOwnerApproval: () => Promise<string>,
  capability: Omit<
    OgabasseyTransformRuleCapability,
    typeof retrievedTransformRuleCapabilityBrand
  >
): Promise<OgabasseyTransformRuleCapability> {
  const [providerReceipt, ownerReceipt] = await Promise.all([
    fetchProviderCapability(),
    fetchOwnerApproval(),
  ]);
  let providerValue: unknown;
  let ownerValue: unknown;
  try {
    providerValue = JSON.parse(providerReceipt);
    ownerValue = JSON.parse(ownerReceipt);
  } catch {
    throw new Error('Transform Rule capability authority is invalid');
  }
  if (
    sha256(providerReceipt) !== capability.providerCapabilitySha256 ||
    sha256(ownerReceipt) !== capability.ownerApprovalSha256 ||
    !exactObject(providerValue, { supported: capability.supported }) ||
    !exactObject(ownerValue, {
      approved: capability.approved,
      incrementalZonePlanCostUsd: capability.incrementalZonePlanCostUsd,
    })
  )
    throw new Error('Transform Rule capability authority does not match');
  const authenticated = Object.freeze({ ...capability });
  retrievedCapabilities.add(authenticated);
  return authenticated as OgabasseyTransformRuleCapability;
}

export function decimalToMinorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

export function validateTransformRuleCapability(
  capability: OgabasseyTransformRuleCapability | undefined
) {
  if (
    !capability ||
    !retrievedCapabilities.has(capability) ||
    capability.supported !== true
  )
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
