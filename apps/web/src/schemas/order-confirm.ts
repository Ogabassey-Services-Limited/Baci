import { z } from 'zod';

/**
 * True only for a `YYYY-MM-DD` calendar date that is strictly in the past.
 * Rejects malformed strings and impossible dates (e.g. 2025-02-31) by checking
 * the parsed UTC components round-trip.
 */
export function isStrictPastDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  if (!yearText || !monthText || !dayText) return false;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const dobTime = Date.UTC(year, month - 1, day);
  const dob = new Date(dobTime);

  if (
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== month - 1 ||
    dob.getUTCDate() !== day
  ) {
    return false;
  }

  const now = new Date();
  const todayTime = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return dobTime < todayTime;
}

export const strictPastDateOnlySchema = z
  .string()
  .refine(isStrictPastDateOnly, {
    message: 'dateOfBirth must be a valid past date',
  });

export const confirmOrderRouteParamsSchema = z.object({
  id: z.uuid(),
});

export const deviceInsuranceDetailsSchema = z.object({
  imei: z.string().trim().min(1).max(64),
  serialNumber: z.string().trim().min(1).max(128),
  deviceColor: z.string().trim().min(1).max(64),
  deviceModel: z.string().trim().min(1).max(128),
  deviceMake: z.string().trim().min(1).max(128),
  deviceType: z.enum(['Phone', 'Laptop', 'Others']),
  deviceValue: z.coerce.number().positive().finite(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  devicePhotos: z.object({
    about: z.url(),
  }),
  customerPhoto: z.url().optional(),
  // Order item these details belong to, so the policy is bound to the intended
  // SKU rather than an arbitrarily-ordered order_items row.
  itemId: z.string().trim().min(1).optional(),
  // Real policyholder KYC is required for insurance — no placeholder data may
  // reach the insurer.
  gender: z.enum(['Male', 'Female']),
  dateOfBirth: strictPastDateOnlySchema,
});

export type DeviceInsuranceDetailsInput = z.infer<
  typeof deviceInsuranceDetailsSchema
>;

/**
 * Root payload for `POST /api/orders/[id]/confirm`. The body is validated in
 * full before any property is read: a confirm carrying device fields (`imei`
 * or `devicePhotos`) must supply the complete insurance KYC, while a plain
 * confirm needs no device data. Output is normalized so the route never has to
 * touch the raw, unvalidated JSON.
 */
const INSURANCE_FIELD_KEYS = [
  'imei',
  'serialNumber',
  'deviceColor',
  'deviceModel',
  'deviceMake',
  'deviceType',
  'deviceValue',
  'purchaseDate',
  'devicePhotos',
  'customerPhoto',
  'gender',
  'dateOfBirth',
] as const;

export const confirmOrderBodySchema = z
  .looseObject({})
  .transform((body, ctx) => {
    // Any insurance-related field signals an intended purchase. We detect the
    // whole set (not just imei/devicePhotos) so a partial payload can't slip
    // through as a plain confirm — it must carry the complete KYC or be rejected.
    const payload = body as Record<string, unknown>;
    const wantsInsurance = INSURANCE_FIELD_KEYS.some(
      (key) => payload[key] !== undefined
    );
    if (!wantsInsurance) {
      return {
        shouldPurchaseInsurance: false as const,
        deviceDetails: null,
      };
    }

    const details = deviceInsuranceDetailsSchema.safeParse(body);
    if (!details.success) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid insurance details',
      });
      return z.NEVER;
    }

    return {
      shouldPurchaseInsurance: true as const,
      deviceDetails: details.data,
    };
  });
