/**
 * MyCover exposes no REST endpoint to file a claim or run a device inspection.
 * Both are completed through hosted links MyCover ships in the
 * `purchase.successful` webhook (persisted on the policy). These helpers decide
 * which action a policy supports so the UI can prefer the official hosted flow
 * and fall back to the public-key SDK only when no link was captured.
 */

import {
  isTerminalClaimStatusToken,
  normalizeInsuranceFlowUrl,
} from '@baci/shared/insurance';

export interface InsuranceActionPolicy {
  claimComment?: string | null;
  claimLink?: string | null;
  claimProgress?: string | null;
  claimStage?: string | null;
  claimStatus?: string | null;
  inspectionLink?: string | null;
  inspectionStatus?: string | null;
  orderDelivered?: boolean;
}

/**
 * The single primary action a policy should surface.
 *
 * Gadget cover requires a post-purchase pre-loss inspection ("Activate
 * Protection") before a claim can be filed — and that inspection can only
 * happen once the device is delivered. So the customer sees exactly one
 * call-to-action at a time:
 *   not delivered yet            -> 'awaiting_delivery' (informational, no action)
 *   delivered, link not stored   -> 'activation_pending' (informational, no action)
 *   delivered, inspection due    -> 'inspect' ("Activate Protection")
 *   inspection done / no inspect -> 'claim'  ("File a Claim")
 *
 * `kind: 'claim'` with `url: null` means no hosted claim link was captured —
 * the caller should fall back to the public-key SDK modal.
 */
export type InsuranceCta =
  | { kind: 'awaiting_delivery' }
  | { kind: 'activation_pending' }
  | { kind: 'claim_existing'; url: string | null }
  | { kind: 'claim_terminal' }
  | { kind: 'inspect'; url: string }
  | { kind: 'claim'; url: string | null };

function getClaimStatusToken(policy: InsuranceActionPolicy): string | null {
  return policy.claimStatus?.trim().toLowerCase() || null;
}

export function isTerminalClaimStatus(policy: InsuranceActionPolicy): boolean {
  return isTerminalClaimStatusToken(policy.claimStatus);
}

function hasExistingClaim(policy: InsuranceActionPolicy): boolean {
  const claimStatus = getClaimStatusToken(policy);
  return (
    Boolean(policy.claimStage?.trim()) ||
    Boolean(policy.claimProgress?.trim()) ||
    Boolean(policy.claimComment?.trim()) ||
    Boolean(claimStatus && claimStatus !== 'none')
  );
}

export function resolveInsuranceCta(
  policy: InsuranceActionPolicy
): InsuranceCta {
  const claimUrl = resolveClaimUrl(policy);

  if (isTerminalClaimStatus(policy)) {
    return { kind: 'claim_terminal' };
  }

  if (hasExistingClaim(policy)) {
    return { kind: 'claim_existing', url: claimUrl };
  }

  const inspectionUrl = resolveInspectionUrl(policy);
  const inspectionStatus = policy.inspectionStatus?.trim().toLowerCase();
  // Gate on the RAW presence of an inspection requirement, not the normalized
  // URL — a stored inspection_link that fails normalization (e.g. an http link
  // or a not-yet-allowlisted host) must still block "File a Claim" before the
  // pre-loss inspection; the normalized URL only decides if the button opens.
  const hasInspectionLink =
    typeof policy.inspectionLink === 'string' &&
    policy.inspectionLink.trim().length > 0;
  const inspectionPending =
    inspectionStatus !== 'completed' &&
    (hasInspectionLink ||
      (inspectionStatus === 'pending' && claimUrl === null));

  if (inspectionPending) {
    if (!policy.orderDelivered) {
      return { kind: 'awaiting_delivery' };
    }
    if (inspectionUrl === null) {
      return { kind: 'activation_pending' };
    }
    return { kind: 'inspect', url: inspectionUrl };
  }

  return { kind: 'claim', url: claimUrl };
}

/** Hosted URL to file a claim, or null when only the SDK fallback is available. */
export function resolveClaimUrl(policy: InsuranceActionPolicy): string | null {
  return normalizeInsuranceFlowUrl(policy.claimLink);
}

/** Hosted URL to complete a device inspection, or null when unavailable. */
export function resolveInspectionUrl(
  policy: InsuranceActionPolicy
): string | null {
  return normalizeInsuranceFlowUrl(policy.inspectionLink);
}
