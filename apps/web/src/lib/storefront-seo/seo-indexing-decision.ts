export type SeoIndexingPageKind = 'home' | 'category' | 'product';

export type SeoIndexingBlocker =
  | 'store_unpublished'
  | 'inactive_category'
  | 'empty_category'
  | 'missing_category_canonical_url'
  | 'inactive_product'
  | 'missing_product_name'
  | 'missing_product_canonical_url';

export interface SeoIndexingDecision {
  pageKind: SeoIndexingPageKind;
  index: boolean;
  follow: true;
  blockers: SeoIndexingBlocker[];
}

export function isValidStorefrontCanonicalUrl(
  value: string | null | undefined
): value is string {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !!url.host
    );
  } catch {
    return false;
  }
}

export function buildSeoIndexingDecision({
  pageKind,
  blockers,
}: {
  pageKind: SeoIndexingPageKind;
  blockers: SeoIndexingBlocker[];
}): SeoIndexingDecision {
  return {
    pageKind,
    index: blockers.length === 0,
    follow: true,
    blockers: [...new Set(blockers)],
  };
}
