const TERMINAL_CLAIM_STATUSES = new Set([
  'declined',
  'disapproved',
  'offer_rejected',
  'paid',
  'rejected',
]);

interface ResolveInsuranceCardActionsInput {
  claimComment?: string | null;
  claimLink?: string | null;
  claimStage?: string | null;
  claimStatus?: string | null;
  inspectionLink?: string | null;
  inspectionStatus?: string | null;
  isDelivered: boolean;
  onCompleteInspection?: ((inspectionUrl: string) => void) | undefined;
  onFileClaim?: ((claimUrl: string) => void) | undefined;
}

export function resolveInsuranceCardActions({
  claimComment,
  claimLink,
  claimStage,
  claimStatus,
  inspectionLink,
  inspectionStatus,
  isDelivered,
  onCompleteInspection,
  onFileClaim,
}: ResolveInsuranceCardActionsInput) {
  const normalizedInspectionStatus = inspectionStatus?.toLowerCase();
  const normalizedClaimStatus = claimStatus?.trim().toLowerCase();
  const hasExplicitClaimProgress =
    !!claimStage?.trim() || !!claimComment?.trim();
  const isPlaceholderPendingClaim =
    normalizedClaimStatus === 'pending' && !hasExplicitClaimProgress;
  const terminalClaim = normalizedClaimStatus
    ? TERMINAL_CLAIM_STATUSES.has(normalizedClaimStatus)
    : false;
  const claimAlreadyStarted =
    hasExplicitClaimProgress ||
    (!!normalizedClaimStatus &&
      normalizedClaimStatus !== 'none' &&
      !isPlaceholderPendingClaim);

  const inspectionPending =
    normalizedInspectionStatus !== 'completed' &&
    (!!inspectionLink ||
      (normalizedInspectionStatus === 'pending' && !claimLink));

  return {
    showActivationPending:
      inspectionPending &&
      isDelivered &&
      !inspectionLink &&
      !claimAlreadyStarted &&
      !terminalClaim,
    showAwaitingDelivery:
      inspectionPending &&
      !isDelivered &&
      !claimAlreadyStarted &&
      !terminalClaim,
    showClaim:
      !inspectionPending &&
      !claimAlreadyStarted &&
      !!claimLink &&
      !!onFileClaim,
    showContinueClaim:
      !inspectionPending &&
      claimAlreadyStarted &&
      !terminalClaim &&
      !!claimLink &&
      !!onFileClaim,
    showInspection:
      inspectionPending &&
      isDelivered &&
      !terminalClaim &&
      !!inspectionLink &&
      !!onCompleteInspection,
  };
}
