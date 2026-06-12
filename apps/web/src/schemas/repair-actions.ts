import { z } from 'zod';

export const repairMerchantIdSchema = z.uuid();

const optionalPlaceText = (maxLength: number) =>
  z.string().trim().max(maxLength).optional().default('');

export const repairPlaceDetailsSchema = z
  .object({
    streetNumber: optionalPlaceText(32),
    route: optionalPlaceText(200),
    city: optionalPlaceText(120),
    state: optionalPlaceText(120),
    zip: optionalPlaceText(32),
    country: optionalPlaceText(120),
    formattedAddress: optionalPlaceText(500),
  })
  .superRefine((place, ctx) => {
    if (!place.formattedAddress || !place.city || !place.state) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a complete pickup address.',
        path: ['formattedAddress'],
      });
    }
  });

export type RepairPlaceDetails = z.output<typeof repairPlaceDetailsSchema>;
