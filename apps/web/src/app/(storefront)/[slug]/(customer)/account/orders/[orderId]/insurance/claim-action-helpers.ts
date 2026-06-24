/**
 * MyCover exposes no REST endpoint to file a claim or run a device inspection.
 * Both are completed through hosted links MyCover ships in the
 * `purchase.successful` webhook (persisted on the policy). These helpers decide
 * which action a policy supports so the UI can prefer the official hosted flow
 * and fall back to the public-key SDK only when no link was captured.
 */

export interface InsuranceActionPolicy {
  claimLink?: string | null;
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
  | { kind: 'inspect'; url: string }
  | { kind: 'claim'; url: string | null };

export function resolveInsuranceCta(
  policy: InsuranceActionPolicy
): InsuranceCta {
  const claimUrl = resolveClaimUrl(policy);
  const inspectionUrl = resolveInspectionUrl(policy);
  const inspectionStatus = policy.inspectionStatus?.trim().toLowerCase();
  const inspectionPending =
    inspectionStatus !== 'completed' &&
    (inspectionUrl !== null ||
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

function normalizeLink(link: string | null | undefined): string | null {
  if (typeof link !== 'string') return null;
  const trimmed = link.trim();
  if (trimmed.length === 0) return null;
  // Only allow http(s) — these links are opened with window.open, so reject
  // unsafe schemes (javascript:, data:) and malformed URLs as defense in depth.
  try {
    const { protocol } = new URL(trimmed);
    if (protocol !== 'https:' && protocol !== 'http:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** Hosted URL to file a claim, or null when only the SDK fallback is available. */
export function resolveClaimUrl(policy: InsuranceActionPolicy): string | null {
  return normalizeLink(policy.claimLink);
}

/** Hosted URL to complete a device inspection, or null when unavailable. */
export function resolveInspectionUrl(
  policy: InsuranceActionPolicy
): string | null {
  return normalizeLink(policy.inspectionLink);
}
