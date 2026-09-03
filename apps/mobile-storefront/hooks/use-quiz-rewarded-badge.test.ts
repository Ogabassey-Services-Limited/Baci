import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

const mockUnlockBadge = jest.fn();
const mockUseQuizMobileAds = jest.fn();
const mockAuthCustomer = { date_of_birth: null as string | null };

jest.mock('@/config/quiz-mobile-ads', () => ({
  getQuizMobileAdsConfig: () => ({
    bannerUnitId: 'banner-unit',
    enabled: true,
    rewardedUnitId: 'rewarded-unit',
  }),
}));
jest.mock('@/hooks/use-quiz-mobile-ads', () => ({
  useQuizMobileAds: (input: unknown) => mockUseQuizMobileAds(input),
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ customer: mockAuthCustomer }),
}));
jest.mock('@/stores/quiz-badge-store', () => ({
  useQuizBadgeStore: (selector: (state: unknown) => unknown) =>
    selector({ getBadge: () => null, unlockBadge: mockUnlockBadge }),
}));

const listeners = new Map<string, (payload?: unknown) => void>();
const mockAd = {
  addAdEventListener: jest.fn(
    (event: string, listener: (payload?: unknown) => void) => {
      listeners.set(event, listener);
      return jest.fn();
    }
  ),
  load: jest.fn(),
  show: jest.fn<() => Promise<void>>(),
};

jest.mock('react-native-google-mobile-ads', () => ({
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
  RewardedAd: {
    createForAdRequest: jest.fn(() => mockAd),
  },
  RewardedAdEventType: { EARNED_REWARD: 'earned-reward', LOADED: 'loaded' },
}));

import { RewardedAdEventType } from 'react-native-google-mobile-ads';
import { useQuizRewardedBadge } from './use-quiz-rewarded-badge';

type GateProps = {
  eventId: string;
  eventTitle: string;
  remainingSeconds: number;
  status: 'active' | 'scheduled';
  userId: string;
};

describe('useQuizRewardedBadge', () => {
  beforeEach(() => {
    listeners.clear();
    mockAuthCustomer.date_of_birth = null;
    mockUnlockBadge.mockClear();
    mockAd.show.mockClear();
    mockUseQuizMobileAds.mockReturnValue({
      canRequestAds: true,
      enabled: true,
      initialized: true,
      rewardedUnitId: 'rewarded-unit',
    });
  });

  it('offers only while more than 90 seconds remain in a scheduled room', () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useQuizRewardedBadge>,
      GateProps
    >(
      ({ eventId, eventTitle, remainingSeconds, status, userId }: GateProps) =>
        useQuizRewardedBadge({
          eventId,
          eventTitle,
          remainingSeconds,
          status,
          userId,
        }),
      {
        initialProps: {
          eventId: 'event-1',
          eventTitle: 'Today Quiz',
          remainingSeconds: 91,
          status: 'scheduled',
          userId: 'user-1',
        },
      }
    );

    expect(result.current.available).toBe(true);
    rerender({
      eventId: 'event-1',
      eventTitle: 'Today Quiz',
      remainingSeconds: 90,
      status: 'scheduled',
      userId: 'user-1',
    });
    expect(result.current.available).toBe(false);
    rerender({
      eventId: 'event-1',
      eventTitle: 'Today Quiz',
      remainingSeconds: 120,
      status: 'active',
      userId: 'user-1',
    });
    expect(result.current.available).toBe(false);
  });

  it('does not request or initialize ads while the shopper is unauthenticated', () => {
    mockUseQuizMobileAds.mockClear();
    const { result } = renderHook(() =>
      useQuizRewardedBadge({
        eventId: 'event-1',
        eventTitle: 'Today Quiz',
        remainingSeconds: 120,
        status: 'scheduled',
        userId: null,
      })
    );

    expect(result.current.available).toBe(false);
    expect(mockUseQuizMobileAds).toHaveBeenCalledWith(
      expect.objectContaining({ requested: false })
    );
  });

  it('passes the verified adult status into rewarded-ad initialization', () => {
    mockAuthCustomer.date_of_birth = '2000-01-01';

    renderHook(() =>
      useQuizRewardedBadge({
        eventId: 'event-1',
        eventTitle: 'Today Quiz',
        remainingSeconds: 120,
        status: 'scheduled',
        userId: 'user-1',
      })
    );

    expect(mockUseQuizMobileAds).toHaveBeenCalledWith(
      expect.objectContaining({ ageVerified: true })
    );
  });

  it('grants only when the ad emits EARNED_REWARD', () => {
    const { result } = renderHook(() =>
      useQuizRewardedBadge({
        eventId: 'event-1',
        eventTitle: 'Today Quiz',
        remainingSeconds: 120,
        status: 'scheduled',
        userId: 'user-1',
      })
    );

    act(() => result.current.watchAd());
    expect(mockUnlockBadge).not.toHaveBeenCalled();
    act(() => listeners.get('closed')?.());
    expect(mockUnlockBadge).not.toHaveBeenCalled();

    act(() => result.current.watchAd());
    act(() =>
      listeners.get(RewardedAdEventType.EARNED_REWARD)?.({ amount: 1 })
    );
    expect(mockUnlockBadge).toHaveBeenCalledWith(
      'user-1',
      'event-1',
      'Today Quiz'
    );
  });

  it('does not block the room when the user dismisses the offer', () => {
    const { result } = renderHook(() =>
      useQuizRewardedBadge({
        eventId: 'event-1',
        eventTitle: 'Today Quiz',
        remainingSeconds: 120,
        status: 'scheduled',
        userId: 'user-1',
      })
    );

    act(() => result.current.dismiss());
    expect(result.current.available).toBe(false);
    expect(result.current.roomBlocked).toBe(false);
  });

  it('does not show a rewarded ad if it finishes loading after dismissal', () => {
    const { result } = renderHook(() =>
      useQuizRewardedBadge({
        eventId: 'event-1',
        eventTitle: 'Today Quiz',
        remainingSeconds: 120,
        status: 'scheduled',
        userId: 'user-1',
      })
    );

    act(() => result.current.watchAd());
    act(() => result.current.dismiss());
    act(() => listeners.get(RewardedAdEventType.LOADED)?.());

    expect(mockAd.show).not.toHaveBeenCalled();
    expect(result.current.isWatching).toBe(false);
  });

  it('cancels a pending ad when the waiting room becomes ineligible', () => {
    const { result, rerender } = renderHook(
      (props: GateProps) => useQuizRewardedBadge(props),
      {
        initialProps: {
          eventId: 'event-1',
          eventTitle: 'Today Quiz',
          remainingSeconds: 120,
          status: 'scheduled',
          userId: 'user-1',
        },
      }
    );

    act(() => result.current.watchAd());
    const loaded = listeners.get(RewardedAdEventType.LOADED);
    rerender({
      eventId: 'event-1',
      eventTitle: 'Today Quiz',
      remainingSeconds: 90,
      status: 'scheduled',
      userId: 'user-1',
    });
    act(() => loaded?.());

    expect(mockAd.show).not.toHaveBeenCalled();
    expect(result.current.isWatching).toBe(false);
  });

  it('keeps reward listeners after the loaded ad is shown when eligibility expires', () => {
    const { result, rerender } = renderHook(
      (props: GateProps) => useQuizRewardedBadge(props),
      {
        initialProps: {
          eventId: 'event-1',
          eventTitle: 'Today Quiz',
          remainingSeconds: 120,
          status: 'scheduled',
          userId: 'user-1',
        },
      }
    );

    mockAd.show.mockResolvedValue(undefined);
    act(() => result.current.watchAd());
    act(() => listeners.get(RewardedAdEventType.LOADED)?.());
    rerender({
      eventId: 'event-1',
      eventTitle: 'Today Quiz',
      remainingSeconds: 90,
      status: 'scheduled',
      userId: 'user-1',
    });

    act(() =>
      listeners.get(RewardedAdEventType.EARNED_REWARD)?.({ amount: 1 })
    );

    expect(mockAd.show).toHaveBeenCalledTimes(1);
    expect(mockUnlockBadge).toHaveBeenCalledWith(
      'user-1',
      'event-1',
      'Today Quiz'
    );
  });

  it('ignores a queued reward after the account or event identity changes', () => {
    const { result, rerender, unmount } = renderHook(
      (props: GateProps) => useQuizRewardedBadge(props),
      {
        initialProps: {
          eventId: 'event-1',
          eventTitle: 'Today Quiz',
          remainingSeconds: 120,
          status: 'scheduled',
          userId: 'user-1',
        },
      }
    );

    act(() => result.current.watchAd());
    const staleReward = listeners.get(RewardedAdEventType.EARNED_REWARD);
    rerender({
      eventId: 'event-2',
      eventTitle: 'Tomorrow Quiz',
      remainingSeconds: 120,
      status: 'scheduled',
      userId: 'user-2',
    });
    act(() => staleReward?.({ amount: 1 }));
    expect(mockUnlockBadge).not.toHaveBeenCalled();

    act(() => result.current.watchAd());
    const currentReward = listeners.get(RewardedAdEventType.EARNED_REWARD);
    unmount();
    act(() => currentReward?.({ amount: 1 }));
    expect(mockUnlockBadge).not.toHaveBeenCalled();
  });

  it('grants at most once when duplicate reward events are queued', () => {
    const { result } = renderHook(() =>
      useQuizRewardedBadge({
        eventId: 'event-1',
        eventTitle: 'Today Quiz',
        remainingSeconds: 120,
        status: 'scheduled',
        userId: 'user-1',
      })
    );

    act(() => result.current.watchAd());
    const reward = listeners.get(RewardedAdEventType.EARNED_REWARD);
    act(() => reward?.({ amount: 1 }));
    act(() => reward?.({ amount: 1 }));
    expect(mockUnlockBadge).toHaveBeenCalledTimes(1);
  });
});
