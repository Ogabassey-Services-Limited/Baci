import z from 'zod';

const privateJwkSchema = z
  .object({
    alg: z.literal('ES256').default('ES256'),
    crv: z.literal('P-256'),
    d: z.string().trim().min(1),
    kid: z.string().trim().min(1),
    kty: z.literal('EC'),
    x: z.string().trim().min(1),
    y: z.string().trim().min(1),
  })
  .passthrough();

const PRIVATE_JWK_ERROR =
  'SUPABASE_AGENTIC_JWT_PRIVATE_JWK must be an ES256 private EC JWK with kid';

const normalizeOptionalString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  // Blank signing-material env vars are intentionally treated as unset so the
  // production either-or validation can fall back to SUPABASE_JWT_SECRET.
  return trimmed || undefined;
};

export const supabaseAgenticJwtPrivateJwkSchema = z
  .string()
  .trim()
  .min(1, 'SUPABASE_AGENTIC_JWT_PRIVATE_JWK cannot be empty')
  .transform((rawPrivateJwk, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawPrivateJwk);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PRIVATE_JWK_ERROR,
      });
      return z.NEVER;
    }

    const result = privateJwkSchema.safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PRIVATE_JWK_ERROR,
      });
      return z.NEVER;
    }

    return result.data;
  });

export const supabaseAgenticJwtPrivateJwkStringSchema = z.preprocess(
  normalizeOptionalString,
  z
    .string()
    .refine(
      (rawPrivateJwk) =>
        supabaseAgenticJwtPrivateJwkSchema.safeParse(rawPrivateJwk).success,
      { message: PRIVATE_JWK_ERROR }
    )
    .optional()
);
