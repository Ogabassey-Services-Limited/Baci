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
  .refine(
    (value) => NigerianPhoneSchema.safeParse(value).success,
    'Repeat phone number must be a valid Nigerian phone number'
  )
  .optional();

const repeatVerifiedSchema = z
  .union([z.boolean(), z.enum(['0', '1', 'false', 'true'])])
  .transform((value) => value === true || value === '1' || value === 'true')
  .optional();

export const RouteRepeatParamsSchema = z.object({
  repeatAmount: repeatAmountSchema,
  repeatBillerName: z.string().optional(),
  repeatBillItemIdentifier: z.string().optional(),
  repeatCustomerIdentifier: z.string().optional(),
  repeatDataPlanCode: z.string().optional(),
  repeatNetworkProvider: z.string().optional(),
  repeatPhoneNumber: repeatPhoneNumberSchema,
  repeatVerified: repeatVerifiedSchema,
});
