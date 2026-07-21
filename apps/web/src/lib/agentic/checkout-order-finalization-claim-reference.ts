const FINALIZATION_CLAIM_PATTERN = /^agentic_order_[a-f0-9]{64}$/;

export function isValidOrderFinalizationClaim(value: string): boolean {
  return FINALIZATION_CLAIM_PATTERN.test(value);
}
