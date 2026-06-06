import { z } from 'zod';

export const ED25519_JWK_SCHEMA = z
  .object({
    crv: z.literal('Ed25519'),
    kty: z.literal('OKP'),
    x: z.string().min(1),
  })
  .passthrough();

export const WEB_BOT_AUTH_JWKS_SCHEMA = z.object({
  keys: z.array(ED25519_JWK_SCHEMA).min(1),
});
