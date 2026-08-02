import { z } from 'zod';

const utcDaySchema = z.iso.date();
const countSchema = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().nonnegative());

const invocationRowSchema = z.tuple([
  utcDaySchema,
  z.literal('mobile_onboarding_contract_invoked'),
  z.enum(['v1_legacy', 'v2_authenticated']),
  countSchema,
]);

const canaryRowSchema = z.tuple([
  utcDaySchema,
  z.literal('mobile_onboarding_contract_telemetry_canary'),
  z.literal('canary'),
  countSchema,
]);

export const postHogMobileOnboardingHealthResponseSchema = z.object({
  results: z.array(z.union([invocationRowSchema, canaryRowSchema])),
  columns: z.array(z.string()).optional(),
});

export type PostHogMobileOnboardingHealthResponse = z.infer<
  typeof postHogMobileOnboardingHealthResponseSchema
>;
