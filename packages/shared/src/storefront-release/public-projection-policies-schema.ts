import { z } from 'zod';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';

const PolicyBodySchema = z
  .string()
  .max(500_000)
  .refine(
    (body) => !hasUnstableBlogContentMedia(body),
    'Policy links and media must be release-safe'
  );

/** Optional public merchant policy bodies embedded in a storefront release. */
export const StorefrontPublicPoliciesSchema = z.strictObject({
  privacy: PolicyBodySchema.optional(),
  terms: PolicyBodySchema.optional(),
  returns: PolicyBodySchema.optional(),
  shipping: PolicyBodySchema.optional(),
});
