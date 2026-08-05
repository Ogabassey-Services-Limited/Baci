import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import { startQuizAttemptV2RequestSchema } from '@baci/shared/schemas';
import { z } from 'zod';
import {
  quizIntegrityTierSchema,
  quizIsoDatetimeSchema,
  quizUuidSchema,
} from './quiz-schema-primitives';

/** A hashed device identifier (SHA-256 hex) supplied only when available. */
export const quizDeviceFingerprintSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Device fingerprint must be a SHA-256 hex digest');

export const startQuizAttemptSchema = z.object({
  entryMode: z.literal(QUIZ_FREE_ENTRY_MODE),
  deviceFingerprint: quizDeviceFingerprintSchema.optional(),
  eventId: quizUuidSchema,
  expectedUserId: z.string().min(1).optional(),
  integrityTier: quizIntegrityTierSchema,
});

export const submitQuizAnswerSchema = z.object({
  answer: z.string().min(1).max(500),
  clientAnsweredAt: quizIsoDatetimeSchema.optional(),
  integrityTier: quizIntegrityTierSchema,
  questionId: quizUuidSchema,
});

/** Device identity is accepted only from the dedicated request header. */
export const startQuizAttemptV2RouteSchema =
  startQuizAttemptV2RequestSchema.omit({ deviceFingerprint: true });

export const submitQuizAnswerV2Schema = z.strictObject({
  answer: z.string().min(1).max(500),
  clientAnsweredAt: quizIsoDatetimeSchema.optional(),
  questionId: quizUuidSchema,
});

export const finalizeQuizAwardsSchema = z.object({
  eventId: quizUuidSchema,
});

export const claimQuizGrandPrizeSchema = z.object({
  eventId: quizUuidSchema,
});

export const claimQuizCashAwardSchema = z.object({
  awardId: quizUuidSchema,
});

export const claimQuizTestInviteSchema = z.strictObject({
  token: z.string().trim().min(32).max(512),
});

export type StartQuizAttemptInput = z.infer<typeof startQuizAttemptSchema>;
export type SubmitQuizAnswerInput = z.infer<typeof submitQuizAnswerSchema>;
export type FinalizeQuizAwardsInput = z.infer<typeof finalizeQuizAwardsSchema>;
export type ClaimQuizGrandPrizeInput = z.infer<
  typeof claimQuizGrandPrizeSchema
>;
export type ClaimQuizCashAwardInput = z.infer<typeof claimQuizCashAwardSchema>;
export type ClaimQuizTestInviteInput = z.infer<
  typeof claimQuizTestInviteSchema
>;
