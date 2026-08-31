import { z } from 'zod';
import {
  TRUST_PROFILE_RETURN_FEES,
  TRUST_PROFILE_RETURN_METHODS,
  TRUST_PROFILE_SHIPPING_FEE_TYPES,
} from '../contracts/merchant-trust-profile';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';

const PolicyBodySchema = z
  .string()
  .max(500_000)
  .refine(
    (body) => !hasUnstableBlogContentMedia(body),
    'Policy links and media must be release-safe'
  );

const PolicyDaysSchema = z.number().int().nonnegative().max(3_650);
const PolicyRegionSchema = z.string().trim().min(1).max(100);
const ReturnPolicySchema = z.strictObject({
  summary: PolicyBodySchema.optional(),
  windowDays: PolicyDaysSchema.optional(),
  returnMethod: z.enum(TRUST_PROFILE_RETURN_METHODS).optional(),
  returnFees: z.enum(TRUST_PROFILE_RETURN_FEES).optional(),
  localRoute: z.literal('/returns'),
});
const ShippingPolicySchema = z
  .strictObject({
    summary: PolicyBodySchema.optional(),
    regions: z.array(PolicyRegionSchema).max(256),
    handlingDaysMin: PolicyDaysSchema.optional(),
    handlingDaysMax: PolicyDaysSchema.optional(),
    transitDaysMin: PolicyDaysSchema.optional(),
    transitDaysMax: PolicyDaysSchema.optional(),
    shippingFeeType: z.enum(TRUST_PROFILE_SHIPPING_FEE_TYPES).optional(),
    localRoute: z.literal('/shipping'),
  })
  .superRefine((policy, context) => {
    if (
      policy.handlingDaysMin !== undefined &&
      policy.handlingDaysMax !== undefined &&
      policy.handlingDaysMin > policy.handlingDaysMax
    )
      context.addIssue({
        code: 'custom',
        message: 'Minimum handling time must not exceed maximum handling time',
        path: ['handlingDaysMin'],
      });
    if (
      policy.transitDaysMin !== undefined &&
      policy.transitDaysMax !== undefined &&
      policy.transitDaysMin > policy.transitDaysMax
    )
      context.addIssue({
        code: 'custom',
        message: 'Minimum transit time must not exceed maximum transit time',
        path: ['transitDaysMin'],
      });
  });

/** Optional public merchant policy bodies embedded in a storefront release. */
export const StorefrontPublicPoliciesSchema = z.strictObject({
  privacy: PolicyBodySchema.optional(),
  terms: PolicyBodySchema.optional(),
  returns: PolicyBodySchema.optional(),
  shipping: PolicyBodySchema.optional(),
  returnPolicy: ReturnPolicySchema.optional(),
  shippingPolicy: ShippingPolicySchema.optional(),
});
