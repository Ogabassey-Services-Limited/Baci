import { quizModeSchema } from '@baci/shared/schemas';
import { z } from 'zod';
import {
  quizIsoDatetimeSchema,
  quizUuidSchema,
} from './quiz-schema-primitives';

const quizEventSettingsSchema = z
  .object({
    prize_name: z.string().optional(),
    prize_product_id: quizUuidSchema.optional(),
    prize_product_image_url: z.string().nullable().optional(),
    prize_product_name: z.string().optional(),
    prize_variant_id: quizUuidSchema.nullable().optional(),
    time_limit_seconds: z.coerce.number().int().positive().optional(),
  })
  // Legacy database settings intentionally normalize unknown keys during rollout.
  .strip();

export const quizEventRowSchema = z.object({
  compliance_verified: z.boolean().nullable().optional(),
  contract_version: z.union([z.literal(1), z.literal(2)]).optional(),
  ends_at: quizIsoDatetimeSchema.nullable(),
  id: quizUuidSchema,
  max_attempts: z.coerce.number().int().positive().optional(),
  mode: quizModeSchema.optional(),
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
  results_published_at: quizIsoDatetimeSchema.nullable().optional(),
  rules_version: z.string().trim().min(1).nullable().optional(),
  settings: quizEventSettingsSchema,
  starts_at: quizIsoDatetimeSchema.nullable(),
  status: z.string().min(1),
  time_zone: z.string().trim().min(1).max(100).optional(),
  title: z.string(),
});

export const quizEventQuestionCountRowSchema = z.object({
  event_id: quizUuidSchema,
  question_count: z.coerce.number().int().nonnegative(),
});

export type QuizEventRow = z.infer<typeof quizEventRowSchema>;
