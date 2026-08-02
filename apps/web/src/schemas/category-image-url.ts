import { z } from 'zod';

/** Schemes an <img src> may safely carry. */
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * A category image URL.
 *
 * `z.url()` alone is not enough: it delegates to the WHATWG parser, which
 * happily accepts `javascript:alert(1)` and `data:text/html,...`. Category
 * images render into `<img src>` on the public storefront, so an unrestricted
 * scheme here is a stored-XSS vector supplied by an authenticated merchant.
 */
export const categoryImageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      return SAFE_IMAGE_PROTOCOLS.has(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Image URL must be an http(s) address');
