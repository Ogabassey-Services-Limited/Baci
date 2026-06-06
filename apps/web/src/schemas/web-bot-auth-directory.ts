import { z } from 'zod';

export const ED25519_JWK_SCHEMA = z
  .object({
    alg: z.string().optional(),
    crv: z.literal('Ed25519'),
    key_ops: z.array(z.string()).optional(),
    kid: z.string().min(1).optional(),
    kty: z.literal('OKP'),
    use: z.string().optional(),
    x: z.string().min(1),
  })
  .strict();

export const WEB_BOT_AUTH_JWKS_SCHEMA = z.object({
  keys: z.array(ED25519_JWK_SCHEMA).min(1),
});
