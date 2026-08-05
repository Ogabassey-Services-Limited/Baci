import {
  QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS,
  QUIZ_LIVE_MAX_ATTEMPTS,
  QUIZ_LIVE_VARIANTS_PER_QUESTION,
  QUIZ_MAX_LOGICAL_QUESTIONS,
  QUIZ_MAX_QUESTIONS_PER_TOPIC,
  QUIZ_MAX_TIME_PER_QUESTION_SECONDS,
  QUIZ_MAX_TOPICS,
  QUIZ_MIN_QUESTIONS_PER_TOPIC,
  QUIZ_MIN_TIME_PER_QUESTION_SECONDS,
  QUIZ_TEST_DEFAULT_MAX_ATTEMPTS,
  QUIZ_TEST_DEFAULT_VARIANTS_PER_QUESTION,
  QUIZ_TEST_MAX_MAX_ATTEMPTS,
  QUIZ_TEST_MAX_VARIANTS_PER_QUESTION,
  QUIZ_TEST_MIN_MAX_ATTEMPTS,
  QUIZ_TEST_MIN_VARIANTS_PER_QUESTION,
} from '@baci/shared/constants';
import { quizModeSchema } from '@baci/shared/schemas';
import { z } from 'zod';
import {
  quizDifficultySchema,
  quizNonEmptyIdSchema,
  quizTopicSchema,
  quizUuidSchema,
} from './quiz-schema-primitives';

export const merchantQuizGenerationRequestSchema = z
  .strictObject({
    difficulty: quizDifficultySchema.prefault('standard'),
    maxAttempts: z.coerce
      .number()
      .int()
      .min(QUIZ_TEST_MIN_MAX_ATTEMPTS)
      .max(QUIZ_TEST_MAX_MAX_ATTEMPTS)
      .optional(),
    mode: quizModeSchema.prefault('test'),
    prizeCondition: z.string().trim().min(1).max(80),
    prizeEffectiveStock: z.number().int().nonnegative().nullable(),
    prizeImageUrl: z.string().trim().min(1).nullable(),
    prizeProductId: quizUuidSchema,
    prizeVariantId: quizUuidSchema.optional(),
    // Installed dashboard bundles already send this explicit marker.
    // Generation remains draft-only; no other value is accepted.
    publicationMode: z.literal('draft').optional(),
    questionCountPerTopic: z.coerce
      .number()
      .int()
      .min(QUIZ_MIN_QUESTIONS_PER_TOPIC)
      .max(QUIZ_MAX_QUESTIONS_PER_TOPIC)
      .prefault(QUIZ_MIN_QUESTIONS_PER_TOPIC),
    timeLimitSeconds: z.coerce
      .number()
      .int()
      .min(QUIZ_MIN_TIME_PER_QUESTION_SECONDS)
      .max(QUIZ_MAX_TIME_PER_QUESTION_SECONDS)
      .prefault(QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS),
    title: z.string().trim().min(3).max(120),
    topics: z.array(quizTopicSchema).min(1).max(QUIZ_MAX_TOPICS),
    variantsPerQuestion: z.coerce
      .number()
      .int()
      .min(QUIZ_TEST_MIN_VARIANTS_PER_QUESTION)
      .max(QUIZ_TEST_MAX_VARIANTS_PER_QUESTION)
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      value.questionCountPerTopic * value.topics.length >
      QUIZ_MAX_LOGICAL_QUESTIONS
    ) {
      context.addIssue({
        code: 'custom',
        message: `A quiz cannot exceed ${QUIZ_MAX_LOGICAL_QUESTIONS} logical questions`,
        path: ['questionCountPerTopic'],
      });
    }

    const normalizedTopics = value.topics.map((topic) => topic.toLowerCase());
    if (new Set(normalizedTopics).size !== normalizedTopics.length) {
      context.addIssue({
        code: 'custom',
        message: 'Topics must be unique regardless of case',
        path: ['topics'],
      });
    }

    if (
      value.mode === 'live' &&
      value.variantsPerQuestion !== undefined &&
      value.variantsPerQuestion !== QUIZ_LIVE_VARIANTS_PER_QUESTION
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Live quizzes require three variants per logical question',
        path: ['variantsPerQuestion'],
      });
    }
    if (
      value.mode === 'live' &&
      value.maxAttempts !== undefined &&
      value.maxAttempts !== QUIZ_LIVE_MAX_ATTEMPTS
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Live quizzes permit exactly one attempt',
        path: ['maxAttempts'],
      });
    }
  })
  .transform((value) => ({
    ...value,
    maxAttempts:
      value.maxAttempts ??
      (value.mode === 'live'
        ? QUIZ_LIVE_MAX_ATTEMPTS
        : QUIZ_TEST_DEFAULT_MAX_ATTEMPTS),
    variantsPerQuestion:
      value.variantsPerQuestion ??
      (value.mode === 'live'
        ? QUIZ_LIVE_VARIANTS_PER_QUESTION
        : QUIZ_TEST_DEFAULT_VARIANTS_PER_QUESTION),
  }));

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
      .max(QUIZ_MAX_LOGICAL_QUESTIONS),
  }),
  confirmActivation: z.literal(true),
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
  questions: z
    .array(generatedQuizQuestionSchema)
    .min(1)
    .max(QUIZ_MAX_LOGICAL_QUESTIONS),
});

const merchantQuizEventSummarySchema = z.object({
  id: quizNonEmptyIdSchema,
  slug: z.string().min(1),
  status: z.string().min(1),
  title: z.string().min(1),
});

export const merchantQuizGenerationResponseSchema = z.object({
  event: merchantQuizEventSummarySchema,
  questions: z.array(generatedQuizQuestionBaseSchema).min(1),
});

export const merchantQuizActivationResponseSchema = z.object({
  event: merchantQuizEventSummarySchema,
});

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
