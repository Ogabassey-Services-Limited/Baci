import { z } from 'zod';

/** Query params for GET /api/quiz/leaderboard. */
export const quizLeaderboardQuerySchema = z.object({
  eventId: z.uuid(),
});

/**
 * Public leaderboard for a quiz event.
 *
 * The route calls the `get_quiz_leaderboard_public` RPC (see 20260721150000):
 * the top 100 rows in rank order with the caller's own row flagged
 * (`is_current_customer`). The richer `get_quiz_leaderboard` RPC also returns
 * the internal `customer_id`/`attempt_id`, but that one is service_role only —
 * the public wrapper scrubs those ids, so this schema never has to. Loyalty
 * points (wallet-like PII) are neither projected nor ranked; standing is skill
 * and speed only, and the board is announced by username.
 *
 * `displayName` is the customer-chosen username where one is set, falling back
 * to the legacy full name for attempts that predate the username requirement.
 */
export const quizLeaderboardEntrySchema = z.object({
  displayName: z.string().min(1),
  /** True for the signed-in player's own rows, so the UI can highlight them. */
  isCurrentCustomer: z.boolean(),
  rank: z.number().int().positive(),
  score: z.number().int().nonnegative(),
  status: z.string().min(1),
  submittedAt: z.string().min(1).nullable(),
  totalTimeSeconds: z.number().nonnegative().nullable(),
});

export type QuizLeaderboardEntry = z.infer<typeof quizLeaderboardEntrySchema>;

export const quizLeaderboardResponseSchema = z.object({
  entries: z.array(quizLeaderboardEntrySchema),
});

export type QuizLeaderboardResponse = z.infer<
  typeof quizLeaderboardResponseSchema
>;

/** Raw row shape returned by the `get_quiz_leaderboard` RPC. */
export const quizLeaderboardRowSchema = z.object({
  customer_name: z.string().nullable(),
  // The RPC computes this per row (the row's customer belongs to the caller).
  is_current_customer: z.boolean().nullable(),
  // bigint over PostgREST arrives as a number or a string depending on size.
  rank: z.union([z.number(), z.string()]),
  score: z.number().nullable(),
  status: z.string().nullable(),
  submitted_at: z.string().nullable(),
  total_time_seconds: z.number().nullable(),
});

export type QuizLeaderboardRow = z.infer<typeof quizLeaderboardRowSchema>;
