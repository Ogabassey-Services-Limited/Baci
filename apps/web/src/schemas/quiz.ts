import { z } from 'zod';

const quizUuidSchema = z.string().uuid();
const quizIsoDatetimeSchema = z.string().datetime({ offset: true });
const quizIntegrityTierSchema = z.enum(['basic', 'device', 'strong']);

export const quizEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    merchantId: quizUuidSchema.optional(),
    merchantSlug: z.string().trim().min(1).max(120).optional(),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((value) => value.merchantId || value.merchantSlug, {
    message: 'merchantId or merchantSlug is required',
    path: ['merchantId'],
  })
  .refine((value) => !(value.merchantId && value.merchantSlug), {
    message: 'provide either merchantId or merchantSlug, not both',
    path: ['merchantId'],
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
  // Forward-compatible settings rows should not break older clients, but typoed
  // unknown keys are silently dropped rather than rejected.
  .strip();

export const quizEventRowSchema = z.object({
  compliance_verified: z.boolean().nullable().optional(),
  ends_at: quizIsoDatetimeSchema.nullable(),
  id: quizUuidSchema,
  nlrc_permit_ref: z.string().nullable().optional(),
  quiz_question_slots: z
    .array(
      z.object({
        active: z.boolean().optional(),
        id: quizUuidSchema,
        quiz_question_variants: z
          .array(
            z.object({
              active: z.boolean().optional(),
              id: quizUuidSchema,
            })
          )
          .optional(),
      })
    )
    .nullable()
    .optional(),
  settings: quizEventSettingsSchema,
  starts_at: quizIsoDatetimeSchema.nullable(),
  status: z.string().min(1),
  title: z.string(),
});

export const quizEventQuestionCountRowSchema = z.object({
  event_id: quizUuidSchema,
  question_count: z.coerce.number().int().nonnegative(),
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
