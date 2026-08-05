import { serializeStorefrontProductPathSegment } from './serialize-storefront-product-path-segment';

export function serializeStorefrontProductPath(path: string): string {
  const normalizedPath = path.replace(/\/+$/, '') || '/';

  return normalizedPath
    .split('/')
    .map((segment, index) =>
      index === 0 ? segment : serializeStorefrontProductPathSegment(segment)
    )
    .join('/');
}
