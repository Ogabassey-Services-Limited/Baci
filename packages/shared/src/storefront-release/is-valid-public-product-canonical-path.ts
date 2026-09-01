import { STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS } from './reserved-category-slugs';

/** Checks that a projected product path names this product in a supported PDP route. */
export function isValidPublicProductCanonicalPath(
  path: string,
  productSlug: string
): boolean {
  const segments = path.split('/').filter(Boolean);
  if (
    (path.length > 1 && path.endsWith('/')) ||
    segments.length !== 2 ||
    segments[1] !== productSlug
  )
    return false;

  const categorySlug = segments[0];
  return (
    categorySlug === 'products' ||
    (categorySlug !== undefined &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(categorySlug) &&
      !categorySlug.includes('.') &&
      !STOREFRONT_RELEASE_RESERVED_CATEGORY_SLUGS.has(categorySlug))
  );
}
