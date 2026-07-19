// First release that persists Juicyway settlement amount/currency metadata on
// transaction creation. Older in-flight sessions were already signed by
// Juicyway but cannot be safely compared to new metadata that did not exist.
const JUICYWAY_SETTLEMENT_METADATA_REQUIRED_AFTER_MS = Date.parse(
  '2026-06-25T14:45:00.000Z'
);
const CANONICAL_DATABASE_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function shouldRequireJuicywaySettlementMetadata(
  createdAt: unknown
): boolean {
  if (
    typeof createdAt !== 'string' ||
    !CANONICAL_DATABASE_TIMESTAMP.test(createdAt)
  ) {
    return true;
  }
  const createdAtMs = Date.parse(createdAt);
  return (
    !Number.isFinite(createdAtMs) ||
    createdAtMs >= JUICYWAY_SETTLEMENT_METADATA_REQUIRED_AFTER_MS
  );
}
