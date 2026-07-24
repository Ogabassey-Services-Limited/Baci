import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizLeaderboardEntry } from '@/schemas/quiz-leaderboard';

const fetchQuizLeaderboardMock = vi.hoisted(() => vi.fn());

vi.mock('./fetch-quiz-leaderboard', () => ({
  fetchQuizLeaderboard: fetchQuizLeaderboardMock,
}));

const ENTRIES: QuizLeaderboardEntry[] = [
  {
    displayName: 'quizking',
    isCurrentCustomer: false,
    rank: 1,
    score: 5,
    status: 'scored',
    submittedAt: '2026-07-14T09:00:00.000Z',
    totalTimeSeconds: 30.5,
  },
];

describe('useQuizLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stays idle and fetches nothing when the event id is null', async () => {
    const { useQuizLeaderboard } = await import('./use-quiz-leaderboard');
    const { result } = renderHook(() => useQuizLeaderboard(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.entries).toEqual([]);
    expect(fetchQuizLeaderboardMock).not.toHaveBeenCalled();
  });

  it('loads the leaderboard for an event id', async () => {
    fetchQuizLeaderboardMock.mockResolvedValue(ENTRIES);

    const { useQuizLeaderboard } = await import('./use-quiz-leaderboard');
    const { result } = renderHook(() => useQuizLeaderboard('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual(ENTRIES);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error and clears entries when the fetch fails', async () => {
    fetchQuizLeaderboardMock.mockRejectedValue(new Error('boom'));

    const { useQuizLeaderboard } = await import('./use-quiz-leaderboard');
    const { result } = renderHook(() => useQuizLeaderboard('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.entries).toEqual([]);
  });
});
