import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import {
  fetchQuizLeaderboard,
  fetchQuizLiveLeaderboard,
  fetchQuizParticipantCount,
} from '@/services/quiz-leaderboard';
import { useQuizResultsLeaderboard } from './use-quiz-results-leaderboard';

jest.mock('@/services/quiz-leaderboard', () => ({
  fetchQuizLeaderboard: jest.fn(),
  fetchQuizParticipantCount: jest.fn(),
  fetchQuizLiveLeaderboard: jest.fn(),
}));

describe('useQuizResultsLeaderboard', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('loads live standings before the universal quiz window closes', async () => {
    jest.mocked(fetchQuizLiveLeaderboard).mockResolvedValue({
      currentPlayer: null,
      entries: [],
      participantCount: null,
      status: 'live',
    });
    jest.mocked(fetchQuizParticipantCount).mockResolvedValue(3);

    const { result } = renderHook(() =>
      useQuizResultsLeaderboard({
        enabled: true,
        eventHasEnded: false,
        eventId: 'event-1',
        expectedUserId: 'user-1',
        lifecycle: 'pending_results',
      })
    );

    await waitFor(() => expect(result.current.participantCount).toBe(3));
    expect(fetchQuizLiveLeaderboard).toHaveBeenCalledWith({
      eventId: 'event-1',
      expectedUserId: 'user-1',
    });
    expect(fetchQuizParticipantCount).toHaveBeenCalledWith({
      eventId: 'event-1',
      expectedUserId: 'user-1',
    });
    expect(fetchQuizLeaderboard).not.toHaveBeenCalled();
  });

  it('retries final standings after the first publication request fails', async () => {
    jest.useFakeTimers();
    jest
      .mocked(fetchQuizLeaderboard)
      .mockRejectedValueOnce(new Error('not published'))
      .mockResolvedValueOnce({
        currentPlayer: null,
        entries: [],
        participantCount: 1,
        status: 'published',
      });
    const { result } = renderHook(() =>
      useQuizResultsLeaderboard({
        enabled: true,
        eventHasEnded: true,
        eventId: 'event-1',
        expectedUserId: 'user-1',
        lifecycle: 'pending_results',
      })
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.leaderboardError).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.leaderboard?.status).toBe('published')
    );
    expect(fetchQuizLeaderboard).toHaveBeenCalledTimes(2);
  });

  it('pauses live standings refresh in the background and resumes in the foreground', async () => {
    const listeners: Array<(state: AppStateStatus) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      });
    jest.mocked(fetchQuizLiveLeaderboard).mockResolvedValue({
      currentPlayer: null,
      entries: [],
      participantCount: null,
      status: 'live',
    });
    jest.mocked(fetchQuizParticipantCount).mockResolvedValue(3);
    jest.useFakeTimers();

    renderHook(() =>
      useQuizResultsLeaderboard({
        enabled: true,
        eventHasEnded: false,
        eventId: 'event-1',
        expectedUserId: 'user-1',
        lifecycle: 'pending_results',
      })
    );
    await waitFor(() =>
      expect(fetchQuizLiveLeaderboard).toHaveBeenCalledTimes(1)
    );

    act(() => listeners[0]?.('background'));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(fetchQuizLiveLeaderboard).toHaveBeenCalledTimes(1);

    act(() => listeners[0]?.('active'));
    await waitFor(() =>
      expect(fetchQuizLiveLeaderboard).toHaveBeenCalledTimes(2)
    );
  });
});
