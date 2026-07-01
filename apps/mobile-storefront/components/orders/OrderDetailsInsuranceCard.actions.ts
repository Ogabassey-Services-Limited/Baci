import {
  isTerminalClaimStatusToken,
  normalizeInsuranceFlowUrl,
} from '@baci/shared/insurance';

interface ResolveInsuranceCardActionsInput {
  claimComment?: string | null;
  claimLink?: string | null;
  claimProgress?: string | null;
  claimStage?: string | null;
  claimStatus?: string | null;
  inspectionLink?: string | null;
  inspectionStatus?: string | null;
  isDelivered: boolean;
  onCompleteInspection?: ((inspectionUrl: string) => void) | undefined;
  onFileClaim?: ((claimUrl: string) => void) | undefined;
  // Fallback used when a claim is warranted but no hosted claim link was
  // captured (legacy policies / missed webhooks) — mirrors the web SDK fallback.
  onFileClaimFallback?: (() => void) | undefined;
}

export interface InsuranceCardActions {
  showActivationPending: boolean;
  showAwaitingDelivery: boolean;
  showClaim: boolean;
  showContinueClaim: boolean;
  showInspection: boolean;
  /** Normalized hosted claim URL, or null when only the fallback is available. */
  claimActionUrl: string | null;
  /** Normalized hosted inspection URL, or null when it can't be opened. */
  inspectionActionUrl: string | null;
}

/**
 * Decide the single insurance call-to-action a policy should surface, matching
 * the web CTA helper's precedence:
 *   terminal claim            -> nothing actionable
 *   claim already in progress -> "Continue Claim" (wins over a stale inspection)
 *   inspection still due       -> "Activate Protection" / awaiting / pending
 *   otherwise                  -> "File a Claim"
 *
 * Hosted links are normalized through the MyCover allowlist before they gate a
 * button: an inspection requirement is detected from the RAW link presence (so a
 * non-normalizable link still blocks claims until inspection is done), but the
 * activation button only opens when the link normalizes — a stale `http://` or
 * non-allowlisted link falls back to the "activation pending" state instead of a
 * dead button.
 */
export function resolveInsuranceCardActions({
  claimComment,
  claimLink,
  claimProgress,
  claimStage,
  claimStatus,
  inspectionLink,
  inspectionStatus,
  isDelivered,
  onCompleteInspection,
  onFileClaim,
  onFileClaimFallback,
}: ResolveInsuranceCardActionsInput): InsuranceCardActions {
  const claimActionUrl = normalizeInsuranceFlowUrl(claimLink ?? null);
  const inspectionActionUrl = normalizeInsuranceFlowUrl(inspectionLink ?? null);

  const normalizedInspectionStatus = inspectionStatus?.trim().toLowerCase();
  const normalizedClaimStatus = claimStatus?.trim().toLowerCase();
  // Mirror the web `hasExistingClaim`: any of stage/progress/comment signals a
  // real, in-progress claim (MyCover may send only `claim_progress`).
  const hasExplicitClaimProgress =
    !!claimStage?.trim() || !!claimProgress?.trim() || !!claimComment?.trim();
  const isPlaceholderPendingClaim =
    normalizedClaimStatus === 'pending' && !hasExplicitClaimProgress;
  const terminalClaim = isTerminalClaimStatusToken(normalizedClaimStatus);
  const claimAlreadyStarted =
    hasExplicitClaimProgress ||
    (!!normalizedClaimStatus &&
      normalizedClaimStatus !== 'none' &&
      !isPlaceholderPendingClaim);

  // A claim action is openable only via the path that actually applies: a
  // hosted link needs `onFileClaim`; a missing link needs the fallback route.
  const canFileClaim = claimActionUrl
    ? !!onFileClaim
    : !!onFileClaimFallback;

  // Inspection requirement is gated on the RAW link presence so a stored but
  // non-normalizable link still blocks claims; the placeholder-pending case
  // only counts while no hosted claim link exists.
  const hasInspectionLink =
    typeof inspectionLink === 'string' && inspectionLink.trim().length > 0;
  const inspectionPending =
    normalizedInspectionStatus !== 'completed' &&
    (hasInspectionLink ||
      (normalizedInspectionStatus === 'pending' && claimActionUrl === null));

  // An in-progress claim takes precedence over a (possibly stale) inspection.
  const inspectionActive =
    !terminalClaim && !claimAlreadyStarted && inspectionPending;

  return {
    claimActionUrl,
    inspectionActionUrl,
    showActivationPending:
      inspectionActive && isDelivered && inspectionActionUrl === null,
    showAwaitingDelivery: inspectionActive && !isDelivered,
    showClaim:
      !terminalClaim &&
      !claimAlreadyStarted &&
      !inspectionPending &&
      canFileClaim,
    showContinueClaim: !terminalClaim && claimAlreadyStarted && canFileClaim,
    showInspection:
      inspectionActive &&
      isDelivered &&
      inspectionActionUrl !== null &&
      !!onCompleteInspection,
  };
}
