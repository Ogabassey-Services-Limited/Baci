import { serializeStorefrontProductPath } from './serialize-storefront-product-path';

export function serializeStorefrontProductUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.origin}${serializeStorefrontProductPath(parsedUrl.pathname)}`;
  } catch {
    return serializeStorefrontProductPath(url);
  }
}
