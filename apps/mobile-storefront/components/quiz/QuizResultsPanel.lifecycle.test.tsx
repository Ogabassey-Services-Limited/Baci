import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchQuizLeaderboard } from '@/services/quiz-leaderboard';
import { fetchQuizLiveLeaderboard } from '@/services/quiz-live-leaderboard';
import { fetchQuizParticipantCount } from '@/services/quiz-participant-count';
import { QuizResultsPanel } from './QuizResultsPanel';
import { createQuizStyles, type QuizThemeColors } from './QuizScreen.styles';

jest.mock('./QuizPrizeClaimPanel', () => ({
  QuizPrizeClaimPanel: () => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return React.createElement(Text, null, 'Claim your prize');
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/services/quiz-leaderboard', () => ({
  fetchQuizLeaderboard: jest.fn(),
}));
jest.mock('@/services/quiz-live-leaderboard', () => ({
  fetchQuizLiveLeaderboard: jest.fn(),
}));
jest.mock('@/services/quiz-participant-count', () => ({
  fetchQuizParticipantCount: jest.fn(),
}));

const colors: QuizThemeColors = {
  background: '#000',
  border: '#222',
  card: '#111',
  error: '#f00',
  muted: '#555',
  primary: '#f90',
  primaryLowOpacity: '#321',
  primaryForeground: '#000',
  success: '#0f8',
  text: '#fff',
  textSecondary: '#aaa',
  warning: '#fb0',
};

describe('QuizResultsPanel lifecycle', () => {
  beforeEach(() => {
    jest.mocked(fetchQuizLeaderboard).mockReset();
    jest.mocked(fetchQuizLiveLeaderboard).mockReset();
    jest.mocked(fetchQuizParticipantCount).mockReset();
    jest.mocked(fetchQuizParticipantCount).mockResolvedValue(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the winner claim first and labels history as a secondary action', () => {
    const onReturnToQuizList = jest.fn();
    render(
      <QuizResultsPanel
        legacyResult={null}
        lifecycle="final"
        onReturnToQuizList={onReturnToQuizList}
        styles={createQuizStyles(colors)}
        v2Result={{
          attemptId: 'a1',
          availability: 'final',
          availableAt: new Date().toISOString(),
          rank: 3,
          score: 8,
          totalQuestions: 10,
          prizeClaim: {
            awardId: 'award-1',
            cartPath: '/ogabassey/cart',
            condition: null,
            productId: 'product-1',
            variantId: null,
            voucherToken: 'voucher-1',
          },
        }}
      />
    );

    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByTestId('quiz-results-scroll')).toBeTruthy();
    expect(screen.getByText(/points · 10 questions/)).toBeTruthy();
    expect(screen.getByText('Claim your prize')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'View past quiz leaderboards' })
    ).toBeTruthy();
    fireEvent.press(
      screen.getByRole('button', { name: 'Return to quiz list' })
    );
    expect(onReturnToQuizList).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('View full leaderboard')).toBeNull();
  });

  it('requests standings after the event deadline while results are still pending', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.mocked(fetchQuizLeaderboard).mockResolvedValue({
      currentPlayer: null,
      entries: [],
      participantCount: 0,
      status: 'published',
    });
    render(
      <QuizResultsPanel
        eventId="event-1"
        eventEndsAt={new Date(1_000).toISOString()}
        expectedUserId="user-1"
        legacyResult={null}
        lifecycle="pending_results"
        serverNow={new Date(0).toISOString()}
        styles={createQuizStyles(colors)}
        v2Result={{
          attemptId: 'attempt-1',
          availability: 'pending',
          availableAt: null,
        }}
      />
    );

    expect(fetchQuizLeaderboard).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1_250);
      await Promise.resolve();
    });
    expect(fetchQuizLeaderboard).toHaveBeenCalledWith({
      eventId: 'event-1',
      expectedUserId: 'user-1',
    });
  });

  it('shows provisional standings immediately after the player finishes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.mocked(fetchQuizLiveLeaderboard).mockResolvedValue({
      currentPlayer: null,
      entries: [
        {
          displayName: 'Bassey',
          isCurrentCustomer: true,
          rank: 1,
          score: 8,
          status: 'submitted',
          submittedAt: new Date(0).toISOString(),
          totalTimeSeconds: 42,
        },
      ],
      participantCount: null,
      status: 'live',
    });
    render(
      <QuizResultsPanel
        eventId="event-1"
        eventEndsAt={new Date(30_000).toISOString()}
        expectedUserId="user-1"
        legacyResult={null}
        lifecycle="pending_results"
        serverNow={new Date(0).toISOString()}
        styles={createQuizStyles(colors)}
        v2Result={{
          attemptId: 'attempt-1',
          availability: 'pending',
          availableAt: null,
        }}
      />
    );
    await act(async () => Promise.resolve());
    expect(screen.getByText('Live standings')).toBeTruthy();
    expect(screen.getByText(/Bassey/)).toBeTruthy();
  });

  it('offers another attempt while a multi-attempt event is still open', () => {
    const onReturnToQuizList = jest.fn();
    render(
      <QuizResultsPanel
        allowPendingResultsExit
        eventId="event-1"
        eventEndsAt={new Date(30_000).toISOString()}
        expectedUserId="user-1"
        legacyResult={null}
        lifecycle="pending_results"
        onReturnToQuizList={onReturnToQuizList}
        serverNow={new Date(0).toISOString()}
        styles={createQuizStyles(colors)}
        v2Result={{
          attemptId: 'attempt-1',
          availability: 'pending',
          availableAt: null,
        }}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Play again' }));
    expect(onReturnToQuizList).toHaveBeenCalledTimes(1);
  });

  it('keeps loaded standings visible while final publication is retried', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.mocked(fetchQuizLiveLeaderboard).mockResolvedValue({
      currentPlayer: null,
      entries: [
        {
          displayName: 'Bassey',
          isCurrentCustomer: true,
          rank: 1,
          score: 8,
          status: 'submitted',
          submittedAt: new Date(0).toISOString(),
          totalTimeSeconds: 42,
        },
      ],
      participantCount: null,
      status: 'live',
    });
    jest
      .mocked(fetchQuizLeaderboard)
      .mockRejectedValue(new Error('not deployed'));
    render(
      <QuizResultsPanel
        eventId="event-1"
        eventEndsAt={new Date(1_000).toISOString()}
        expectedUserId="user-1"
        legacyResult={null}
        lifecycle="pending_results"
        serverNow={new Date(0).toISOString()}
        styles={createQuizStyles(colors)}
        v2Result={{
          attemptId: 'attempt-1',
          availability: 'pending',
          availableAt: null,
        }}
      />
    );
    await act(async () => Promise.resolve());
    await act(async () => {
      jest.advanceTimersByTime(1_250);
      await Promise.resolve();
    });
    expect(screen.getByText(/Bassey/)).toBeTruthy();
    expect(screen.queryByLabelText('Loading final standings')).toBeNull();
  });

  it('retries standings while server publication is still finishing', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(30_000);
    jest
      .mocked(fetchQuizLeaderboard)
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValueOnce({
        currentPlayer: null,
        entries: [],
        participantCount: 0,
        status: 'published',
      });

    render(
      <QuizResultsPanel
        eventId="event-1"
        eventEndsAt={new Date(1_000).toISOString()}
        expectedUserId="user-1"
        legacyResult={null}
        lifecycle="pending_results"
        serverNow={new Date(30_000).toISOString()}
        styles={createQuizStyles(colors)}
        v2Result={{
          attemptId: 'attempt-1',
          availability: 'pending',
          availableAt: null,
        }}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchQuizLeaderboard).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(fetchQuizLeaderboard).toHaveBeenCalledTimes(2);
  });
});
