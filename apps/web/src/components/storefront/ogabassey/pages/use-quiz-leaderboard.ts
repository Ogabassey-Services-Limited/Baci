'use client';

import { useEffect, useState } from 'react';
import type { QuizLeaderboardEntry } from '@/schemas/quiz-leaderboard';
import { fetchQuizLeaderboard } from './fetch-quiz-leaderboard';
import { getQuizErrorMessage } from './get-quiz-error-message';

interface UseQuizLeaderboardResult {
  entries: QuizLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Loads the leaderboard for one event. Pass `null` to stay idle (e.g. before the
 * player has finished). Re-fetches whenever the event id changes, and ignores a
 * resolved response for a stale event so a fast second play cannot render the
 * previous board.
 */
export function useQuizLeaderboard(
  eventId: string | null
): UseQuizLeaderboardResult {
  const [entries, setEntries] = useState<QuizLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEntries([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    fetchQuizLeaderboard(eventId)
      .then((result) => {
        if (!active) return;
        setEntries(result);
      })
      .catch((caught) => {
        if (!active) return;
        setEntries([]);
        setError(getQuizErrorMessage(caught));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  return { entries, error, isLoading };
}
