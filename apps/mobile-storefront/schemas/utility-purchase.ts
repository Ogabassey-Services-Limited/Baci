import { z } from 'zod';
import { NigerianPhoneSchema } from '@/lib/validation/auth-schemas';

const repeatAmountSchema = z
  .coerce.number()
  .finite()
  .positive('Repeat amount must be greater than 0')
  .optional();

const repeatPhoneNumberSchema = z
  .string()
  .trim()
  .pipe(NigerianPhoneSchema)
  .optional();

const repeatVerifiedSchema = z
  .union([z.boolean(), z.enum(['0', '1', 'false', 'true'])])
  .transform((value) => value === true || value === '1' || value === 'true')
  .optional();

export const RouteRepeatParamsSchema = z.object({
  repeatAmount: repeatAmountSchema,
  repeatBillerName: z.string().trim().optional(),
  repeatBillItemIdentifier: z.string().trim().optional(),
  repeatCustomerIdentifier: z.string().trim().optional(),
  repeatDataPlanCode: z.string().trim().optional(),
  repeatNetworkProvider: z.string().trim().optional(),
  repeatPhoneNumber: repeatPhoneNumberSchema,
  repeatVerified: repeatVerifiedSchema,
});
