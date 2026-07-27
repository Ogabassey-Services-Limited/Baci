import { z } from 'zod';

const claimedDeliveryBaseSchema = z.strictObject({
  attempt_number: z.number().int().positive(),
  claim_token: z.uuid(),
  claimed_at: z.iso.datetime({ offset: true }),
  destination: z.enum([
    'facebook',
    'ga4',
    'snapchat',
    'storefront_cache_transition',
    'tiktok',
  ]),
  domain_event_id: z.uuid(),
  id: z.uuid(),
  payload: z.unknown(),
});

export const claimedEventDeliverySchema = z.union([
  claimedDeliveryBaseSchema.extend({
    destination: z.literal('storefront_cache_transition'),
    generation: z.number().int().positive(),
    obligation_id: z.uuid(),
  }),
  claimedDeliveryBaseSchema.extend({
    destination: z.enum(['facebook', 'ga4', 'snapchat', 'tiktok']),
  }),
]);
