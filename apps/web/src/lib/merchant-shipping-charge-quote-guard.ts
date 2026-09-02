const ACTIVE_STATUSES = new Set([
  'reserved',
  'provider_submitting',
  'needs_reconciliation',
]);

export function blocksShippingQuoteReplacement(input: {
  previousQuoteId: string | null;
  nextQuoteId: string | null;
  chargeStatuses: string[];
}): boolean {
  if (input.previousQuoteId === input.nextQuoteId) return false;
  return input.chargeStatuses.some((status) => ACTIVE_STATUSES.has(status));
}
