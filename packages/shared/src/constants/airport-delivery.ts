/** Fixed local airport-delivery fees used by every checkout surface. */
export const AIRPORT_DELIVERY_FEES = {
  delivery: 35_000,
  pickup: 20_000,
} as const;

/**
 * Fees emitted by checkout clients released before the local airport fee
 * change. They remain useful only as a server-side migration signal when an
 * older client omits delivery metadata.
 */
export const LEGACY_AIRPORT_DELIVERY_FEES = {
  delivery: 25_000,
  pickup: 20_000,
} as const;
