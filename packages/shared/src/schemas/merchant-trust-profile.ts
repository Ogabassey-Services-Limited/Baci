import { z } from 'zod';
import {
  TRUST_PROFILE_RETURN_FEES,
  TRUST_PROFILE_RETURN_METHODS,
  TRUST_PROFILE_SHIPPING_FEE_TYPES,
} from '../contracts/merchant-trust-profile';

const nullableStringField = z.string().nullable().optional();
const nullableIntegerField = z.number().int().nonnegative().nullable().optional();

export const MerchantTrustProfileDraftSchema = z.object({
  founded_year: nullableIntegerField,
  customer_service: z
    .object({
      whatsapp_number: nullableStringField,
      hours_summary: nullableStringField,
      timezone: nullableStringField,
      response_time_summary: nullableStringField,
    })
    .strict()
    .nullable()
    .optional(),
  return_policy: z
    .object({
      summary: nullableStringField,
      window_days: nullableIntegerField,
      return_method: z.enum(TRUST_PROFILE_RETURN_METHODS).nullable().optional(),
      return_fees: z.enum(TRUST_PROFILE_RETURN_FEES).nullable().optional(),
    })
    .strict()
    .nullable()
    .optional(),
  shipping_policy: z
    .object({
      summary: nullableStringField,
      regions: z.array(z.string()).nullable().optional(),
      handling_days_min: nullableIntegerField,
      handling_days_max: nullableIntegerField,
      transit_days_min: nullableIntegerField,
      transit_days_max: nullableIntegerField,
      shipping_fee_type: z
        .enum(TRUST_PROFILE_SHIPPING_FEE_TYPES)
        .nullable()
        .optional(),
    })
    .strict()
    .nullable()
    .optional(),
  warranty_policy: z
    .object({
      summary: nullableStringField,
    })
    .strict()
    .nullable()
    .optional(),
}).strict();
