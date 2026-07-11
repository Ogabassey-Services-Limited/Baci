/**
 * Deterministic slug helpers for the repairs catalogue.
 *
 * Devices and service types carry a UNIQUE (merchant_id, slug) constraint, so
 * inserts generate a base slug and disambiguate against slugs already taken by
 * the merchant. Pure functions — no DB access here.
 */

const NON_SLUG_CHARS = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;

export function slugifyRepair(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(NON_SLUG_CHARS, '-')
    .replace(EDGE_HYPHENS, '');
  return slug || 'item';
}

export function buildDeviceSlug(brand: string, model: string): string {
  return slugifyRepair(`${brand} ${model}`);
}

/**
 * Returns `base` if it is not in `taken`, otherwise `base-2`, `base-3`, ...
 * until a free slug is found. Does not mutate `taken`.
 */
export function nextAvailableSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
