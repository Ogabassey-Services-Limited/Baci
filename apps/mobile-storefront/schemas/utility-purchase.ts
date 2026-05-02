import { z } from 'zod';
import { NigerianPhoneSchema } from '@/lib/validation/auth-schemas';

const repeatAmountSchema = z.coerce
  .number()
  .finite()
  .positive('Repeat amount must be greater than 0')
  .optional();

const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const trimmedOptionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().optional()
);

// Empty phone strings are rejected rather than omitted so malformed repeat
// links fail validation instead of silently dropping the recipient.
const repeatPhoneNumberSchema = z
  .string()
  .trim()
  .min(1, 'Repeat phone number cannot be empty')
  .pipe(NigerianPhoneSchema)
  .optional();

function transformRepeatVerified(
  value: boolean | '0' | '1' | 'false' | 'true'
) {
  return value === true || value === '1' || value === 'true';
}

const repeatVerifiedSchema = z
  .union([z.boolean(), z.enum(['0', '1', 'false', 'true'])])
  .transform(transformRepeatVerified)
  .optional();

export const RouteRepeatParamsSchema = z.object({
  repeatAmount: repeatAmountSchema,
  repeatBillerName: trimmedOptionalString,
  repeatBillItemIdentifier: trimmedOptionalString,
  repeatCustomerIdentifier: trimmedOptionalString,
  repeatCustomerName: trimmedOptionalString,
  repeatDataPlanCode: trimmedOptionalString,
  repeatNetworkProvider: trimmedOptionalString,
  repeatPhoneNumber: repeatPhoneNumberSchema,
  repeatVerified: repeatVerifiedSchema,
});
