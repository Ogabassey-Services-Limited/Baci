import { apiGet } from '@/lib/api-client';
import {
  type QuizLeaderboardEntry,
  quizLeaderboardResponseSchema,
} from '@/schemas/quiz-leaderboard';

/**
 * Fetches the public leaderboard for one event. The response is validated
 * against the shared schema, so a malformed payload throws rather than
 * rendering garbage — the caller maps that to an error state.
 */
export async function fetchQuizLeaderboard(
  eventId: string
): Promise<QuizLeaderboardEntry[]> {
  const query = new URLSearchParams({ eventId });
  const parsed = quizLeaderboardResponseSchema.safeParse(
    await apiGet<unknown>(`/api/quiz/leaderboard?${query}`)
  );

  if (!parsed.success) {
    throw new Error('Invalid quiz leaderboard response');
  }

  return parsed.data.entries;
}
