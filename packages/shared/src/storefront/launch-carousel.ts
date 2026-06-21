/**
 * Selection + labelling helpers for the storefront "Just Launched" / newly
 * released devices carousel, shared by web and mobile so both surface the same
 * pinned launches in the same order.
 *
 * Ordering contract: pinned slugs first (in the given pin order), then the
 * remaining input in its existing order, deduped by slug. The caller is
 * responsible for supplying input that is already "newest-first" — this helper
 * deliberately does NOT sort by date (web orders by `updated_at`, mobile by
 * `created_at`; neither field is guaranteed on the input rows).
 */

/** Devices explicitly pinned to the front of the launch carousel. */
export const PINNED_LAUNCH_SLUGS = [
  'samsung-galaxy-a27-5g',
  'itel-power-80-128gb-4gb',
] as const;

/**
 * How many slides the carousel shows. Single source of truth across web
 * display, web JSON-LD prepend, and mobile display. Must stay ≤ the home
 * collection-schema product limit (8) so every visible slide is represented in
 * structured data.
 */
export const LAUNCH_CAROUSEL_LIMIT = 6;

interface ProductWithSlug {
  slug?: string | null;
}

interface SelectLaunchProductsOptions {
  /** Slugs to hoist to the front, in priority order. */
  pinned?: readonly string[];
  /** Maximum number of items to return. Omit for no cap. */
  limit?: number;
}

/**
 * Pinned-first, then input order, deduped by slug, capped at `limit`.
 * A plain `[...pinnedRows, ...windowRows]` concat is safe input — dedup keeps
 * the first occurrence of each slug. Rows without a slug are passed through
 * (they can be neither pinned nor deduped).
 */
export function selectLaunchProducts<T extends ProductWithSlug>(
  items: readonly T[],
  options: SelectLaunchProductsOptions = {}
): T[] {
  const { pinned = [], limit } = options;

  const firstBySlug = new Map<string, T>();
  for (const item of items) {
    const slug = item.slug;
    if (typeof slug === 'string' && slug.length > 0 && !firstBySlug.has(slug)) {
      firstBySlug.set(slug, item);
    }
  }

  const result: T[] = [];
  const used = new Set<string>();

  for (const slug of pinned) {
    const item = firstBySlug.get(slug);
    if (item && !used.has(slug)) {
      result.push(item);
      used.add(slug);
    }
  }

  for (const item of items) {
    const slug = item.slug;
    if (typeof slug !== 'string' || slug.length === 0) {
      result.push(item);
      continue;
    }
    if (!used.has(slug)) {
      result.push(item);
      used.add(slug);
    }
  }

  return typeof limit === 'number' ? result.slice(0, limit) : result;
}

/** Whether a product name signals a pre-order launch. */
export function isPreorder(name: string): boolean {
  return /pre-?order/i.test(name);
}

/** Pre-order-aware call-to-action label for a launch slide. */
export function launchCtaLabel(name: string): string {
  return isPreorder(name) ? 'Pre-order now' : 'Shop now';
}
