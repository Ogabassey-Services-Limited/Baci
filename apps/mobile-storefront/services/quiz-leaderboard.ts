import { z } from 'zod';
import { requestQuizV2 } from './quiz';
import type { QuizLeaderboard, QuizServiceOptions } from './quiz-types';

const leaderboardEntrySchema = z.strictObject({
  displayName: z.string().trim().min(1),
  isCurrentCustomer: z.boolean(),
  rank: z.number().int().positive(),
  score: z.number().int().nonnegative(),
  status: z.string().min(1),
  submittedAt: z.string().nullable(),
  totalTimeSeconds: z.number().nonnegative().nullable(),
});

const leaderboardSchema = z.strictObject({
  currentPlayer: leaderboardEntrySchema.nullable(),
  entries: z.array(leaderboardEntrySchema).max(100),
  participantCount: z.number().int().nonnegative().nullable(),
  status: z.enum(['published', 'live', 'live_hidden', 'unavailable']),
});

export interface FetchQuizLeaderboardInput extends QuizServiceOptions {
  eventId: string;
  expectedUserId: string;
}

export function fetchQuizLeaderboard({
  baseUrl,
  eventId,
  expectedUserId,
}: FetchQuizLeaderboardInput): Promise<QuizLeaderboard> {
  const query = new URLSearchParams({ eventId }).toString();
  return requestQuizV2(
    `/api/quiz/leaderboard?${query}`,
    { method: 'GET' },
    leaderboardSchema,
    { baseUrl, expectedUserId }
  );
}

export function fetchQuizLiveLeaderboard({
  baseUrl,
  eventId,
  expectedUserId,
}: FetchQuizLeaderboardInput): Promise<QuizLeaderboard> {
  const query = new URLSearchParams({ eventId }).toString();
  return requestQuizV2(
    `/api/quiz/leaderboard/live?${query}`,
    { method: 'GET' },
    leaderboardSchema,
    { baseUrl, expectedUserId }
  );
}

export function fetchQuizParticipantCount({
  baseUrl,
  eventId,
  expectedUserId,
}: FetchQuizLeaderboardInput): Promise<number> {
  const query = new URLSearchParams({ eventId }).toString();
  return requestQuizV2(
    `/api/quiz/leaderboard/count?${query}`,
    { method: 'GET' },
    z.strictObject({ participantCount: z.number().int().nonnegative() }),
    { baseUrl, expectedUserId }
  ).then((result) => result.participantCount);
}
