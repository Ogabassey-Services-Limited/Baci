import { z } from 'zod';

const quizUuidSchema = z.string().uuid();
const quizIsoDatetimeSchema = z.string().datetime({ offset: true });
const quizIntegrityTierSchema = z.enum(['basic', 'device', 'strong']);
const quizDifficultySchema = z.enum(['easy', 'standard', 'hard']);
const merchantQuizPublicationModeSchema = z.enum(['draft', 'active']);
const quizNonEmptyIdSchema = z.string().min(1);
const quizTopicSchema = z.string().trim().min(3).max(80);

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

export const merchantQuizGenerationRequestSchema = z.object({
  difficulty: quizDifficultySchema.default('standard'),
  prizeName: z.string().trim().min(1).max(120).default('Quiz prize'),
  publicationMode: merchantQuizPublicationModeSchema.default('draft'),
  questionCountPerTopic: z.coerce.number().int().min(1).max(5).default(1),
  timeLimitSeconds: z.coerce.number().int().min(5).max(60).default(30),
  title: z.string().trim().min(3).max(120),
  topics: z.array(quizTopicSchema).min(1).max(10),
});

export const generatedQuizOptionSchema = z.object({
  id: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(160),
});

const generatedQuizQuestionBaseSchema = z.object({
  correctOptionId: z.string().trim().min(1).max(20),
  difficulty: quizDifficultySchema,
  explanation: z.string().trim().min(1).max(500),
  options: z.array(generatedQuizOptionSchema).min(2).max(6),
  prompt: z.string().trim().min(8).max(300),
  topic: quizTopicSchema,
});

export const generatedQuizQuestionSchema =
  generatedQuizQuestionBaseSchema.superRefine((value, context) => {
    if (!value.options.some((option) => option.id === value.correctOptionId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctOptionId must match one of the option ids',
        path: ['correctOptionId'],
      });
    }
  });

export const generatedQuizQuestionsSchema = z.object({
  questions: z.array(generatedQuizQuestionSchema).min(1).max(50),
});

export const merchantQuizGenerationResponseSchema = z.object({
  event: z.object({
    id: quizNonEmptyIdSchema,
    slug: z.string().min(1),
    status: z.string().min(1),
    title: z.string().min(1),
  }),
  questions: z.array(
    generatedQuizQuestionBaseSchema.omit({
      correctOptionId: true,
      explanation: true,
    })
  ),
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

export const quizOptionResponseSchema = z.object({
  id: quizNonEmptyIdSchema,
  label: z.string().min(1),
});

export const quizQuestionResponseSchema = z.object({
  id: quizNonEmptyIdSchema,
  index: z.number().int().positive(),
  options: z.array(quizOptionResponseSchema).min(1),
  prompt: z.string().min(1),
  timeLimitSeconds: z.number().int().positive(),
  total: z.number().int().positive(),
});

export const quizEventResponseSchema = z.object({
  endsAt: quizIsoDatetimeSchema.nullable(),
  id: quizNonEmptyIdSchema,
  prizeName: z.string().min(1),
  questionCount: z.number().int().positive(),
  startsAt: quizIsoDatetimeSchema.nullable(),
  status: z.enum(['open', 'scheduled', 'closed']),
  title: z.string().min(1),
});

export const quizEventsResponseSchema = z.object({
  events: z.array(quizEventResponseSchema),
  pagination: z
    .object({
      hasMore: z.boolean(),
      limit: z.number().int().positive(),
      nextOffset: z.number().int().nonnegative().nullable(),
      offset: z.number().int().nonnegative(),
    })
    .optional(),
});

export const quizAttemptResponseSchema = z.object({
  attemptId: quizNonEmptyIdSchema,
  eventId: quizNonEmptyIdSchema,
  examPassPointsSpent: z.number().int().positive(),
  question: quizQuestionResponseSchema,
  remainingLoyaltyPoints: z.number().int().nonnegative(),
});

export const quizResultResponseSchema = z
  .object({
    attemptId: quizNonEmptyIdSchema,
    correctAnswers: z.number().int().nonnegative(),
    prizeEligible: z.boolean(),
    question: quizQuestionResponseSchema.optional(),
    status: z.enum(['completed', 'in_progress']),
    totalQuestions: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (value.status === 'in_progress' && !value.question) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'In-progress quiz responses must include the next question',
        path: ['question'],
      });
    }
    if (value.correctAnswers > value.totalQuestions) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctAnswers cannot exceed totalQuestions',
        path: ['correctAnswers'],
      });
    }
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
export type MerchantQuizGenerationInput = z.infer<
  typeof merchantQuizGenerationRequestSchema
>;
export type GeneratedQuizQuestion = z.infer<typeof generatedQuizQuestionSchema>;
export type MerchantQuizGenerationResponse = z.infer<
  typeof merchantQuizGenerationResponseSchema
>;
export type QuizEventResponse = z.infer<typeof quizEventResponseSchema>;
export type QuizAttemptResponse = z.infer<typeof quizAttemptResponseSchema>;
export type QuizResultResponse = z.infer<typeof quizResultResponseSchema>;
