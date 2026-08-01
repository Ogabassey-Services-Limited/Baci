import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /\d/u.test(token));
}

function getModelTokens(slug: string, excludedTokens: ReadonlySet<string>) {
  return tokenize(slug).filter((token) => !excludedTokens.has(token));
}

/**
 * Returns compact, model-specific identifiers for the supplied catalog slugs.
 * Brand and category words are deliberately removed so a generic brand guide
 * cannot receive a product-match boost merely by repeating the hub context.
 */
export function getProductModelIdentifiers(
  context: Pick<
    BuildCommercialGuideLinksContext,
    'categorySlug' | 'brands' | 'productSlugs'
  >
) {
  const excludedTokens = new Set(
    [
      ...(context.brands ?? []).flatMap(tokenize),
      ...CONTENT_CLUSTER_SUPPORT[context.categorySlug].categoryNames.flatMap(
        tokenize
      ),
    ].filter(Boolean)
  );

  return Array.from(
    new Set(
      (context.productSlugs ?? [])
        .map((slug) => getModelTokens(slug, excludedTokens))
        .map(
          (tokens) =>
            tokens.find((token) => /\d/u.test(token)) ?? tokens[0] ?? null
        )
        .filter((token): token is string => Boolean(token))
    )
  );
}
