import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import { z } from 'zod';

/** Supabase timestamptz values are ISO strings with a timezone offset. */
const quizEventDateTimeSchema = z.iso.datetime({ offset: true }).nullable();
const quizUuidSchema = z.uuid();

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
  entryMode: z.literal(QUIZ_FREE_ENTRY_MODE),
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
  // Entry is free, so this is 0. Deliberately NOT z.literal(EXAM_PASS_POINTS_COST):
  // a literal would hard-fail any attempt started against a database that still
  // charges (e.g. an installed app during a deploy window, or an older build).
  examPassPointsSpent: z.number().int().nonnegative(),
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
 * whole object is optional while nullable fields stay present as `null` when
 * unset. Mirrors the authoritative web
 * shape in `apps/web/src/schemas/quiz.ts` (`quizResultResponseSchema.prizeClaim`).
 */
export const quizPrizeClaimSchema = z.object({
  awardId: quizUuidSchema,
  productId: quizUuidSchema,
  variantId: quizUuidSchema.nullable(),
  condition: quizPrizeConditionSchema.nullable(),
  voucherToken: z.string().trim().min(1).max(512),
  cartPath: z.string().trim().min(1).max(1024),
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
