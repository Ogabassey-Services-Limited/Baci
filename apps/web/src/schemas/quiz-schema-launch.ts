import {
  QUIZ_LIVE_MAX_ATTEMPTS,
  QUIZ_LIVE_VARIANTS_PER_QUESTION,
  QUIZ_MAX_LOGICAL_QUESTIONS,
  QUIZ_MAX_TIME_PER_QUESTION_SECONDS,
  QUIZ_MIN_TIME_PER_QUESTION_SECONDS,
  QUIZ_TEST_MAX_MAX_ATTEMPTS,
  QUIZ_TEST_MAX_VARIANTS_PER_QUESTION,
  QUIZ_TEST_MIN_MAX_ATTEMPTS,
  QUIZ_TEST_MIN_VARIANTS_PER_QUESTION,
} from '@baci/shared/constants';
import { quizModeSchema } from '@baci/shared/schemas';
import { z } from 'zod';
import {
  quizIsoDatetimeSchema,
  quizUuidSchema,
} from './quiz-schema-primitives';

const quizActivationTimingSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('immediate'),
    liveWindowSeconds: z.coerce.number().int().positive(),
  }),
  z.strictObject({
    endsAt: quizIsoDatetimeSchema,
    kind: z.literal('scheduled'),
    startsAt: quizIsoDatetimeSchema,
  }),
]);

export const merchantQuizActivationV2RequestSchema = z
  .strictObject({
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
    eventId: quizUuidSchema,
    maxAttempts: z.coerce
      .number()
      .int()
      .min(QUIZ_TEST_MIN_MAX_ATTEMPTS)
      .max(QUIZ_TEST_MAX_MAX_ATTEMPTS),
    mode: quizModeSchema,
    rulesVersion: z.string().trim().min(1).max(100),
    timing: quizActivationTimingSchema,
    timePerQuestionSeconds: z.coerce
      .number()
      .int()
      .min(QUIZ_MIN_TIME_PER_QUESTION_SECONDS)
      .max(QUIZ_MAX_TIME_PER_QUESTION_SECONDS),
    timeZone: z.string().trim().min(1).max(100),
    variantsPerQuestion: z.coerce
      .number()
      .int()
      .min(QUIZ_TEST_MIN_VARIANTS_PER_QUESTION)
      .max(QUIZ_TEST_MAX_VARIANTS_PER_QUESTION),
  })
  .superRefine((value, context) => {
    if (value.mode === 'live' && value.maxAttempts !== QUIZ_LIVE_MAX_ATTEMPTS)
      context.addIssue({
        code: 'custom',
        message: 'Live quizzes permit exactly one attempt',
        path: ['maxAttempts'],
      });
    if (
      value.mode === 'live' &&
      value.variantsPerQuestion !== QUIZ_LIVE_VARIANTS_PER_QUESTION
    )
      context.addIssue({
        code: 'custom',
        message: 'Live quizzes require three variants per logical question',
        path: ['variantsPerQuestion'],
      });
    if (
      value.timing.kind === 'scheduled' &&
      Date.parse(value.timing.endsAt) <= Date.parse(value.timing.startsAt)
    )
      context.addIssue({
        code: 'custom',
        message: 'endsAt must be after startsAt',
        path: ['timing', 'endsAt'],
      });
  });

export type MerchantQuizActivationV2Input = z.infer<
  typeof merchantQuizActivationV2RequestSchema
>;
