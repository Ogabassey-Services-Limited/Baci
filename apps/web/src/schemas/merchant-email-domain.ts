import { z } from 'zod';

/** A registrable apex/sub domain like `ogabassey.com` — no scheme or path. */
const DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const registerEmailDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(100)
    .regex(DOMAIN_PATTERN, 'Enter a valid domain (e.g. mystore.com)'),
});

export const setEmailDomainEnabledSchema = z.object({
  enabled: z.boolean(),
});

export type RegisterEmailDomainInput = z.infer<
  typeof registerEmailDomainSchema
>;
