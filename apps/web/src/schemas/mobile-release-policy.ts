import { z } from 'zod';

export const mobileReleasePolicyQuerySchema = z.object({
  app: z.literal('storefront'),
  buildNumber: z.string().trim().min(1),
  channel: z.string().trim().min(1),
  nativeVersion: z.string().trim().min(1),
  platform: z.enum(['android', 'ios']),
  runtimeVersion: z.string().trim().min(1),
});

export type MobileReleasePolicyQuery = z.infer<
  typeof mobileReleasePolicyQuerySchema
>;

export type MobileReleasePolicyPlatform = MobileReleasePolicyQuery['platform'];
