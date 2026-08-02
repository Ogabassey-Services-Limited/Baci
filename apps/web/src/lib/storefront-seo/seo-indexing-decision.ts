export const SEO_PAGE_KINDS = ['home', 'category', 'product'] as const;

export type SeoPageKind = (typeof SEO_PAGE_KINDS)[number];

export type SeoIndexBlocker =
  | 'store_unpublished'
  | 'missing_canonical_url'
  | 'missing_merchant_name'
  | 'category_unavailable'
  | 'category_data_unavailable'
  | 'category_empty'
  | 'product_inactive'
  | 'missing_product_name'
  | 'missing_product_canonical_url';

export interface SeoIndexingDecision {
  pageKind: SeoPageKind;
  index: boolean;
  follow: true;
  blockers: readonly SeoIndexBlocker[];
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
  pageKind: SeoPageKind;
  blockers: readonly SeoIndexBlocker[];
}): SeoIndexingDecision {
  return {
    pageKind,
    index: blockers.length === 0,
    follow: true,
    blockers: [...new Set(blockers)],
  };
}
