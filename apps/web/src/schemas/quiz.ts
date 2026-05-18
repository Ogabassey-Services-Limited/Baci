import { z } from 'zod';

const quizUuidSchema = z.string().uuid();
const quizIsoDatetimeSchema = z.string().datetime({ offset: true });
const quizIntegrityTierSchema = z.enum(['basic', 'device', 'strong']);

export const quizEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const startQuizAttemptSchema = z.object({
  eventId: quizUuidSchema,
  integrityTier: quizIntegrityTierSchema,
});

export const submitQuizAnswerSchema = z.object({
  answer: z.string().min(1).max(500),
  clientAnsweredAt: quizIsoDatetimeSchema.optional(),
  integrityTier: quizIntegrityTierSchema,
  questionId: quizUuidSchema,
});

export const finalizeQuizAwardsSchema = z.object({
  eventId: quizUuidSchema,
});

export const quizAttemptParamsSchema = z.object({
  attemptId: quizUuidSchema,
});

export const claimQuizGrandPrizeSchema = z.object({
  eventId: quizUuidSchema,
});

export const claimQuizCashAwardSchema = z.object({
  awardId: quizUuidSchema,
});

export const quizEventSettingsSchema = z
  .object({
    prize_name: z.string().optional(),
    time_limit_seconds: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const quizEventRowSchema = z.object({
  ends_at: quizIsoDatetimeSchema.nullable(),
  id: quizUuidSchema,
  quiz_question_slots: z
    .array(z.object({ id: quizUuidSchema }))
    .nullable()
    .optional(),
  settings: quizEventSettingsSchema,
  starts_at: quizIsoDatetimeSchema.nullable(),
  status: z.string().min(1),
  title: z.string(),
});

export type QuizEventRow = z.infer<typeof quizEventRowSchema>;
export type QuizEventsQuery = z.infer<typeof quizEventsQuerySchema>;
export type StartQuizAttemptInput = z.infer<typeof startQuizAttemptSchema>;
export type SubmitQuizAnswerInput = z.infer<typeof submitQuizAnswerSchema>;
export type FinalizeQuizAwardsInput = z.infer<typeof finalizeQuizAwardsSchema>;
export type QuizAttemptParams = z.infer<typeof quizAttemptParamsSchema>;
export type ClaimQuizGrandPrizeInput = z.infer<
  typeof claimQuizGrandPrizeSchema
>;
export type ClaimQuizCashAwardInput = z.infer<typeof claimQuizCashAwardSchema>;
