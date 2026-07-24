import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizResultResponse } from '@/schemas/quiz';

const useQuizLeaderboardMock = vi.hoisted(() => vi.fn());

vi.mock('./use-quiz-leaderboard', () => ({
  useQuizLeaderboard: useQuizLeaderboardMock,
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

import { QuizResultPanel } from './quiz-result-panel';

function result(overrides: Partial<QuizResultResponse> = {}): QuizResultResponse {
  return {
    attemptId: 'attempt-1',
    correctAnswers: 4,
    prizeEligible: true,
    status: 'completed',
    totalQuestions: 5,
    ...overrides,
  };
}

describe('QuizResultPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuizLeaderboardMock.mockReturnValue({
      entries: [],
      error: null,
      isLoading: false,
    });
  });

  it('shows the score and records a prize entry', () => {
    render(
      <QuizResultPanel
        eventId="event-1"
        onBackToQuizzes={vi.fn()}
        result={result({ correctAnswers: 4, totalQuestions: 5 })}
      />
    );

    expect(screen.getByText('4 of 5')).toBeInTheDocument();
    expect(screen.getByText(/prize entry recorded/i)).toBeInTheDocument();
  });

  it('shows a practice message when the result is not prize-eligible', () => {
    render(
      <QuizResultPanel
        eventId="event-1"
        onBackToQuizzes={vi.fn()}
        result={result({ prizeEligible: false })}
      />
    );

    expect(screen.getByText(/practice result recorded/i)).toBeInTheDocument();
  });

  it('loads the leaderboard for the played event', () => {
    render(
      <QuizResultPanel
        eventId="event-42"
        onBackToQuizzes={vi.fn()}
        result={result()}
      />
    );

    expect(useQuizLeaderboardMock).toHaveBeenCalledWith('event-42');
  });

  it('renders leaderboard rows returned by the hook', () => {
    useQuizLeaderboardMock.mockReturnValue({
      entries: [
        {
          displayName: 'topplayer',
          isCurrentCustomer: false,
          rank: 1,
          score: 5,
          status: 'scored',
          submittedAt: '2026-07-14T09:00:00.000Z',
          totalTimeSeconds: 22.2,
        },
      ],
      error: null,
      isLoading: false,
    });

    render(
      <QuizResultPanel
        eventId="event-1"
        onBackToQuizzes={vi.fn()}
        result={result()}
      />
    );

    expect(screen.getByText('topplayer')).toBeInTheDocument();
  });

  it('calls back when the player chooses to return to the quiz list', () => {
    const onBack = vi.fn();
    render(
      <QuizResultPanel eventId="event-1" onBackToQuizzes={onBack} result={result()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /back to quizzes/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
