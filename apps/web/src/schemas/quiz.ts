import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import { z } from 'zod';

const quizUuidSchema = z.uuid();
const quizIsoDatetimeSchema = z.iso.datetime({ offset: true });
const quizIntegrityTierSchema = z.enum(['basic', 'device', 'strong']);
const quizDifficultySchema = z.enum(['easy', 'standard', 'hard']);
const quizNonEmptyIdSchema = z.string().min(1);
const quizTopicSchema = z.string().trim().min(3).max(80);
const quizPrizeConditionSchema = z
  .enum(['new', 'used', 'open_box', 'refurbished'])
  .nullable();

export const quizEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).prefault(20),
    merchantId: quizUuidSchema.optional(),
    merchantSlug: z.string().trim().min(1).max(120).optional(),
    offset: z.coerce.number().int().min(0).prefault(0),
  })
  .refine((value) => value.merchantId || value.merchantSlug, {
    path: ['merchantId'],
    error: 'merchantId or merchantSlug is required',
  })
  .refine((value) => !(value.merchantId && value.merchantSlug), {
    path: ['merchantId'],
    error: 'provide either merchantId or merchantSlug, not both',
  });

/**
 * A hashed device identifier (SHA-256 hex). Mobile derives it from the native
 * install id; web derives it server-side from an httpOnly cookie. Optional
 * because a client that cannot produce one must still be able to play — the
 * per-customer and email-identity caps still apply to it.
 */
export const quizDeviceFingerprintSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Device fingerprint must be a SHA-256 hex digest');

export const startQuizAttemptSchema = z.object({
  entryMode: z.literal(QUIZ_FREE_ENTRY_MODE),
  deviceFingerprint: quizDeviceFingerprintSchema.optional(),
  eventId: quizUuidSchema,
  /**
   * The auth user the caller intended to start for. Cookies are ambient (and a
   * CSRF re-init/retry can pause the POST), so if the session switched to
   * another shopper the request would consume THEIR attempt. When present the
   * route rejects a mismatch (409) — mirrors the customer DOB PATCH.
   */
  expectedUserId: z.string().min(1).optional(),
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
  prizeProductId: quizUuidSchema,
  prizeVariantId: quizUuidSchema.optional(),
  questionCountPerTopic: z.coerce.number().int().min(1).max(5).prefault(1),
  timeLimitSeconds: z.coerce.number().int().min(5).max(60).prefault(30),
  title: z.string().trim().min(3).max(120),
  topics: z.array(quizTopicSchema).min(1).max(10),
});

// Activation is a deliberate second step after a human reviews the answer key.
export const merchantQuizActivationRequestSchema = z.object({
  answerKeyReview: z.object({
    questions: z
      .array(
        z.object({
          correctOptionId: z.string().trim().min(1).max(20),
          position: z.int().positive(),
        })
      )
      .min(1)
      .max(50),
  }),
  confirmActivation: z.literal(true),
  // Optional close deadline. Ranked-prize quizzes need an end for the winner-mint
  // cron to finalize them (a quiz with no ends_at is open-ended and only closes
  // on an explicit 'completed' update). Must be a future ISO-8601 UTC instant.
  endsAt: z
    .string()
    .datetime({ message: 'endsAt must be an ISO 8601 UTC datetime' })
    .refine((value) => new Date(value).getTime() > Date.now(), {
      message: 'endsAt must be in the future',
    })
    .optional(),
  eventId: quizUuidSchema,
});

const merchantQuizPrizeProductSchema = z.object({
  defaultVariantId: quizUuidSchema.nullable(),
  id: quizUuidSchema,
  imageUrl: z.string().trim().min(1).nullable(),
  name: z.string().trim().min(1).max(180),
  price: z.coerce.number().nonnegative(),
});

export const merchantQuizPrizeProductsResponseSchema = z.object({
  products: z.array(merchantQuizPrizeProductSchema),
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

const generatedQuizQuestionSchema = generatedQuizQuestionBaseSchema.superRefine(
  (value, context) => {
    if (!value.options.some((option) => option.id === value.correctOptionId)) {
      context.addIssue({
        code: 'custom',
        message: 'correctOptionId must match one of the option ids',
        path: ['correctOptionId'],
      });
    }
  }
);

export const generatedQuizQuestionsSchema = z.object({
  questions: z.array(generatedQuizQuestionSchema).min(1).max(50),
});

const merchantQuizEventSummarySchema = z.object({
  id: quizNonEmptyIdSchema,
  slug: z.string().min(1),
  status: z.string().min(1),
  title: z.string().min(1),
});

// Admin-only response (ogabassey + marketing/edit gate): includes the AI-marked
// `correctOptionId`/`explanation` for answer-key review before opening the
// event. Never reuse for the storefront player response, which keeps answers hashed.
export const merchantQuizGenerationResponseSchema = z.object({
  event: merchantQuizEventSummarySchema,
  questions: z.array(generatedQuizQuestionBaseSchema).min(1),
});

export const merchantQuizActivationResponseSchema = z.object({
  event: merchantQuizEventSummarySchema,
});

const quizEventSettingsSchema = z
  .object({
    prize_name: z.string().optional(),
    prize_product_id: quizUuidSchema.optional(),
    prize_product_image_url: z.string().nullable().optional(),
    prize_product_name: z.string().optional(),
    prize_variant_id: quizUuidSchema.nullable().optional(),
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

const quizOptionResponseSchema = z.object({
  id: quizNonEmptyIdSchema,
  label: z.string().min(1),
});

const quizQuestionResponseSchema = z.object({
  deadlineAt: quizIsoDatetimeSchema,
  id: quizNonEmptyIdSchema,
  index: z.int().positive(),
  options: z.array(quizOptionResponseSchema).min(1),
  prompt: z.string().min(1),
  timeLimitSeconds: z.int().positive(),
  total: z.int().positive(),
});

const quizEventResponseSchema = z.object({
  endsAt: quizIsoDatetimeSchema.nullable(),
  id: quizNonEmptyIdSchema,
  prizeName: z.string().min(1),
  prizeProduct: z
    .object({
      id: quizUuidSchema,
      imageUrl: z.string().trim().min(1).nullable(),
      name: z.string().trim().min(1),
      variantId: quizUuidSchema.nullable(),
    })
    .optional(),
  questionCount: z.int().positive(),
  startsAt: quizIsoDatetimeSchema.nullable(),
  status: z.enum(['open', 'scheduled', 'closed']),
  title: z.string().min(1),
});

export const quizEventsResponseSchema = z.object({
  events: z.array(quizEventResponseSchema),
  pagination: z
    .object({
      hasMore: z.boolean(),
      limit: z.int().positive(),
      nextOffset: z.int().nonnegative().nullable(),
      offset: z.int().nonnegative(),
    })
    .optional(),
});

export const quizAttemptResponseSchema = z.object({
  attemptId: quizNonEmptyIdSchema,
  eventId: quizNonEmptyIdSchema,
  // Entry is free, so this is 0. It stays in the contract (rather than being
  // dropped) so clients pinned to the old shape keep parsing, and so a stale
  // database that still charges during a deploy window is also accepted.
  examPassPointsSpent: z.int().nonnegative(),
  question: quizQuestionResponseSchema,
  remainingLoyaltyPoints: z.int().nonnegative(),
});

export const quizResultResponseSchema = z
  .object({
    attemptId: quizNonEmptyIdSchema,
    correctAnswers: z.int().nonnegative(),
    prizeClaim: z
      .object({
        awardId: quizUuidSchema,
        cartPath: z.string().trim().min(1).max(1024),
        condition: quizPrizeConditionSchema,
        productId: quizUuidSchema,
        variantId: quizUuidSchema.nullable(),
        voucherToken: z.string().trim().min(1).max(512),
      })
      .optional(),
    prizeEligible: z.boolean(),
    question: quizQuestionResponseSchema.optional(),
    status: z.enum(['completed', 'in_progress']),
    totalQuestions: z.int().positive(),
  })
  .superRefine((value, context) => {
    if (value.status === 'in_progress' && !value.question) {
      context.addIssue({
        code: 'custom',
        message: 'In-progress quiz responses must include the next question',
        path: ['question'],
      });
    }
    if (value.correctAnswers > value.totalQuestions) {
      context.addIssue({
        code: 'custom',
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
export type MerchantQuizActivationInput = z.infer<
  typeof merchantQuizActivationRequestSchema
>;
export type GeneratedQuizQuestion = z.infer<typeof generatedQuizQuestionSchema>;
export type MerchantQuizGenerationResponse = z.infer<
  typeof merchantQuizGenerationResponseSchema
>;
export type MerchantQuizActivationResponse = z.infer<
  typeof merchantQuizActivationResponseSchema
>;
export type MerchantQuizPrizeProduct = z.infer<
  typeof merchantQuizPrizeProductSchema
>;
export type MerchantQuizPrizeProductsResponse = z.infer<
  typeof merchantQuizPrizeProductsResponseSchema
>;
export type QuizEventResponse = z.infer<typeof quizEventResponseSchema>;
export type QuizAttemptResponse = z.infer<typeof quizAttemptResponseSchema>;
export type QuizResultResponse = z.infer<typeof quizResultResponseSchema>;
