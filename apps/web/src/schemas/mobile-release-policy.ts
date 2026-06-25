import { z } from 'zod';

/** The native apps that consume the in-app update gate. */
export const MOBILE_APPS = ['storefront', 'admin'] as const;

export const mobileReleasePolicyQuerySchema = z.object({
  app: z.enum(MOBILE_APPS),
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
export type MobileApp = MobileReleasePolicyQuery['app'];
