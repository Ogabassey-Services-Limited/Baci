import { z } from 'zod';

export const quizOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const quizQuestionSchema = z.object({
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
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  status: z.enum(['open', 'scheduled', 'closed']),
  questionCount: z.number().int().positive(),
});

export const quizEventsResponseSchema = z.object({
  events: z.array(quizEventSchema),
});

export const quizAttemptSchema = z.object({
  attemptId: z.string().min(1),
  eventId: z.string().min(1),
  question: quizQuestionSchema,
});

export const quizResultSchema = z
  .object({
    attemptId: z.string().min(1),
    status: z.enum(['completed', 'in_progress']),
    correctAnswers: z.number().int().nonnegative(),
    totalQuestions: z.number().int().positive(),
    prizeEligible: z.boolean(),
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
  });
