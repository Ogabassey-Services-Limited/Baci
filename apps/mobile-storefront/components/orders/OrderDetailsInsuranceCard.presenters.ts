import { INSURANCE_COLORS } from './OrderDetailsInsuranceCard.styles';

/**
 * Status badge colours for a policy. Terminal states (expired/cancelled) use a
 * neutral `inactive` treatment rather than the amber "pending" one, which would
 * imply the policy is still coming.
 */
export function resolvePolicyStatusColors(status: string | null | undefined) {
  const token = status?.trim().toLowerCase();
  if (token === 'active') return INSURANCE_COLORS.active;
  if (token === 'pending') return INSURANCE_COLORS.pending;
  return INSURANCE_COLORS.inactive;
}

/**
 * Customer-facing claim label. Suppresses bare placeholder claim states (the DB
 * default `pending`, or `none`) so internal tokens never surface; real stages
 * and statuses render with underscores humanized. Returns '' when there is
 * nothing meaningful to show.
 */
export function resolveDisplayClaimLabel(
  claimStage: string | null | undefined,
  claimStatus: string | null | undefined
): string {
  const stage = claimStage?.trim();
  const statusToken = claimStatus?.trim().toLowerCase();
  const hasRealStatus =
    !!statusToken && statusToken !== 'none' && statusToken !== 'pending';
  return (stage || (hasRealStatus ? claimStatus?.trim() : '') || '').replace(
    /_/g,
    ' '
  );
}
