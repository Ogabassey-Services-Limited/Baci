/** Fixed local airport-delivery fees used by every checkout surface. */
export const AIRPORT_DELIVERY_FEES = {
  delivery: 35_000,
  pickup: 20_000,
} as const;

/**
 * Fixed delivery fee used by mobile builds released before airport metadata
 * was added to the checkout request.
 */
export const LEGACY_AIRPORT_DELIVERY_FEE = 25_000;
