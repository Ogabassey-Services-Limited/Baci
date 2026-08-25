import type { RefinementCtx } from 'zod';

interface ProjectionIdentityPayload {
  blogPosts?: readonly { id: string; slug: string }[];
  categories?: readonly { id: string; slug: string }[];
  contentPages?: readonly { id: string; slug: string }[];
  featureFlags?: readonly { key: string }[];
  products: readonly {
    conditionOffers?: readonly { id: string }[];
    id: string;
    slug: string;
    variants?: readonly { id: string }[];
  }[];
}

function addDuplicateIssue(
  context: RefinementCtx,
  message: string,
  path: PropertyKey[]
) {
  context.addIssue({ code: 'custom', message, path });
}

/** Adds deterministic identity-collision issues to a projection refinement. */
export function validatePublicProjectionIdentities(
  payload: ProjectionIdentityPayload,
  context: RefinementCtx
) {
  const productIds = new Set<string>();
  const productSlugs = new Set<string>();
  const variantIds = new Set<string>();
  const offerIds = new Set<string>();
  for (const [productIndex, product] of payload.products.entries()) {
    for (const [value, seen, field, message] of [
      [product.id, productIds, 'id', 'Product IDs must be unique'],
      [product.slug, productSlugs, 'slug', 'Product slugs must be unique'],
    ] as const) {
      if (seen.has(value))
        addDuplicateIssue(context, message, ['products', productIndex, field]);
      seen.add(value);
    }
    for (const [variantIndex, variant] of (product.variants ?? []).entries()) {
      if (variantIds.has(variant.id))
        addDuplicateIssue(context, 'Variant IDs must be unique', [
          'products',
          productIndex,
          'variants',
          variantIndex,
          'id',
        ]);
      variantIds.add(variant.id);
    }
    for (const [offerIndex, offer] of (
      product.conditionOffers ?? []
    ).entries()) {
      if (offerIds.has(offer.id))
        addDuplicateIssue(context, 'Condition offer IDs must be unique', [
          'products',
          productIndex,
          'conditionOffers',
          offerIndex,
          'id',
        ]);
      offerIds.add(offer.id);
    }
  }

  const categoryIds = new Set<string>();
  const categorySlugs = new Set<string>();
  for (const [categoryIndex, category] of (payload.categories ?? []).entries())
    for (const [value, seen, field, message] of [
      [category.id, categoryIds, 'id', 'Category IDs must be unique'],
      [category.slug, categorySlugs, 'slug', 'Category slugs must be unique'],
    ] as const) {
      if (seen.has(value))
        addDuplicateIssue(context, message, [
          'categories',
          categoryIndex,
          field,
        ]);
      seen.add(value);
    }

  const blogPostIds = new Set<string>();
  const blogPostSlugs = new Set<string>();
  for (const [postIndex, post] of (payload.blogPosts ?? []).entries())
    for (const [value, seen, field, message] of [
      [post.id, blogPostIds, 'id', 'Blog post IDs must be unique'],
      [post.slug, blogPostSlugs, 'slug', 'Blog post slugs must be unique'],
    ] as const) {
      if (seen.has(value))
        addDuplicateIssue(context, message, ['blogPosts', postIndex, field]);
      seen.add(value);
    }

  const contentPageIds = new Set<string>();
  const contentPageSlugs = new Set<string>();
  for (const [pageIndex, page] of (payload.contentPages ?? []).entries())
    for (const [value, seen, field, message] of [
      [page.id, contentPageIds, 'id', 'Content page IDs must be unique'],
      [
        page.slug,
        contentPageSlugs,
        'slug',
        'Content page slugs must be unique',
      ],
    ] as const) {
      if (seen.has(value))
        addDuplicateIssue(context, message, ['contentPages', pageIndex, field]);
      seen.add(value);
    }

  const featureFlagKeys = new Set<string>();
  for (const [flagIndex, flag] of (payload.featureFlags ?? []).entries()) {
    if (featureFlagKeys.has(flag.key))
      addDuplicateIssue(context, 'Feature flag keys must be unique', [
        'featureFlags',
        flagIndex,
        'key',
      ]);
    featureFlagKeys.add(flag.key);
  }
}
