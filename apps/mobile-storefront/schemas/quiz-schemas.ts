import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import { z } from 'zod';

/** Supabase timestamptz values are ISO strings with a timezone offset. */
const quizEventDateTimeSchema = z.iso.datetime({ offset: true }).nullable();

export const quizOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const quizQuestionSchema = z.object({
  deadlineAt: z.iso.datetime({ offset: true }),
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(quizOptionSchema).min(1),
  timeLimitSeconds: z.number().int().positive(),
  // The API returns this as a 1-based display position, not an array offset.
  index: z.number().int().positive(),
  total: z.number().int().positive(),
});

export const quizEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prizeName: z.string().min(1),
  startsAt: quizEventDateTimeSchema,
  endsAt: quizEventDateTimeSchema,
  status: z.enum(['open', 'scheduled', 'closed']),
  questionCount: z.number().int().positive(),
});

export const quizEventsResponseSchema = z.object({
  events: z.array(quizEventSchema),
  pagination: z
    .object({
      hasMore: z.boolean(),
      limit: z.number().int().positive(),
      nextOffset: z.number().int().nonnegative().nullable(),
      offset: z.number().int().nonnegative(),
    })
    .optional(),
});

export const quizAttemptSchema = z.object({
  attemptId: z.string().min(1),
  eventId: z.string().min(1),
  examPassPointsSpent: z.literal(EXAM_PASS_POINTS_COST),
  remainingLoyaltyPoints: z.number().int().nonnegative(),
  question: quizQuestionSchema,
});

export const quizPrizeConditionSchema = z.enum([
  'new',
  'used',
  'open_box',
  'refurbished',
]);

/**
 * Winning submissions carry a signed prize voucher the mobile client redeems by
 * adding the prize product to the cart. Non-winning responses omit it, so the
 * whole object is optional and inner nullable fields use `.nullish()` to accept
 * either `null` (server default) or an absent key. Mirrors the authoritative web
 * shape in `apps/web/src/schemas/quiz.ts` (`quizResultResponseSchema.prizeClaim`).
 */
export const quizPrizeClaimSchema = z.object({
  awardId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1).nullish(),
  condition: quizPrizeConditionSchema.nullish(),
  voucherToken: z.string().min(1),
  cartPath: z.string().min(1),
});

export const quizResultSchema = z
  .object({
    attemptId: z.string().min(1),
    status: z.enum(['completed', 'in_progress']),
    correctAnswers: z.number().int().nonnegative(),
    totalQuestions: z.number().int().positive(),
    prizeEligible: z.boolean(),
    prizeClaim: quizPrizeClaimSchema.optional(),
    question: quizQuestionSchema.optional(),
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
