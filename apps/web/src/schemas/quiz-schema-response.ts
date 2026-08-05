import {
  getQuizMaximumPlaySeconds,
  QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS,
  QUIZ_DEFAULT_TIME_ZONE,
  QUIZ_LIVE_MAX_ATTEMPTS,
} from '@baci/shared/constants';
import {
  quizV2EventSchema,
  quizV2EventsResponseSchema,
} from '@baci/shared/schemas';
import { z } from 'zod';
import {
  quizIsoDatetimeSchema,
  quizNonEmptyIdSchema,
  quizPrizeConditionSchema,
  quizUuidSchema,
} from './quiz-schema-primitives';

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

const legacyQuizEventResponseSchema = z
  .looseObject({
    contractVersion: z.literal(1).optional(),
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
  })
  .superRefine((value, context) => {
    if (
      value.startsAt &&
      value.endsAt &&
      Date.parse(value.endsAt) <= Date.parse(value.startsAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      });
    }
    for (const field of [
      'liveWindowSeconds',
      'maxAttempts',
      'maximumPlaySeconds',
      'mode',
      'resultsPublishedAt',
      'rulesVersion',
      'timePerQuestionSeconds',
      'timeZone',
    ]) {
      if (field in value) {
        context.addIssue({
          code: 'custom',
          message: `Contract version 1 events must not include v2 field ${field}`,
          path: [field],
        });
      }
    }
  })
  .transform((value) => {
    const timePerQuestionSeconds = QUIZ_DEFAULT_TIME_PER_QUESTION_SECONDS;
    const liveWindowSeconds =
      value.startsAt && value.endsAt
        ? Math.max(
            0,
            Math.floor(
              (Date.parse(value.endsAt) - Date.parse(value.startsAt)) / 1000
            )
          )
        : null;

    return {
      contractVersion: 1 as const,
      endsAt: value.endsAt,
      id: value.id,
      liveWindowSeconds,
      maxAttempts: QUIZ_LIVE_MAX_ATTEMPTS,
      maximumPlaySeconds: getQuizMaximumPlaySeconds(
        value.questionCount,
        timePerQuestionSeconds
      ),
      mode: 'live' as const,
      prizeName: value.prizeName,
      prizeProduct: value.prizeProduct
        ? { ...value.prizeProduct, condition: null }
        : undefined,
      questionCount: value.questionCount,
      resultsPublishedAt: null,
      rulesVersion: null,
      startsAt: value.startsAt,
      status: value.status,
      timePerQuestionSeconds,
      timeZone: QUIZ_DEFAULT_TIME_ZONE,
      title: value.title,
    };
  });

/** Accepts strict v2 events and safe defaults only for legacy v1 event rows. */
export const quizEventResponseSchema = z.union([
  quizV2EventSchema,
  legacyQuizEventResponseSchema,
]);

const quizPaginationSchema = z.strictObject({
  hasMore: z.boolean(),
  limit: z.int().positive(),
  nextOffset: z.int().nonnegative().nullable(),
  offset: z.int().nonnegative(),
});

const legacyQuizEventsResponseSchema = z
  .object({
    contractVersion: z.literal(1).optional(),
    events: z.array(legacyQuizEventResponseSchema),
    pagination: quizPaginationSchema.optional(),
    serverNow: quizIsoDatetimeSchema.optional(),
  })
  .strip();

export const quizEventsResponseSchema = z.union([
  quizV2EventsResponseSchema,
  legacyQuizEventsResponseSchema,
]);

export const quizAttemptResponseSchema = z.object({
  attemptId: quizNonEmptyIdSchema,
  eventId: quizNonEmptyIdSchema,
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

export type QuizEventResponse = z.infer<typeof quizEventResponseSchema>;
export type QuizAttemptResponse = z.infer<typeof quizAttemptResponseSchema>;
export type QuizResultResponse = z.infer<typeof quizResultResponseSchema>;
