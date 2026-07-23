// Shared retry-policy constants for the paid-order side-effect outbox
// (payment_side_effects). These MUST stay in sync with the SQL claim RPC
// `claim_payment_side_effect` (migration 20260721093205), whose ON CONFLICT
// guard uses the same `attempts < CAP` ceiling and excludes the same permanent
// errors — if they drift, the drain could re-select a row the RPC refuses to
// re-claim (or vice versa).

// Hard ceiling on automatic claim/drain attempts. A deterministic failure that
// survives this many tries stops being retried by the normal drain so a broken
// side effect cannot loop forever. Rows that hit the cap are surfaced and
// slow-lane recovered by `recoverStrandedPaidOrderSideEffects` rather than left
// permanently stranded.
export const PAID_ORDER_SIDE_EFFECT_ATTEMPT_CAP = 5;

// Errors known to be permanent: retrying cannot help, so rows carrying them are
// excluded from both the drain and stranded-row recovery.
export const PERMANENT_PAID_ORDER_SIDE_EFFECT_ERRORS = [
  'wired_in_b3_5',
  'financial_totals_inconsistent',
  'gateway_verification_terminal',
] as const;
