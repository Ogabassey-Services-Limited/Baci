import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchQuizLeaderboard } from '@/services/quiz-leaderboard';
import { fetchQuizLiveLeaderboard } from '@/services/quiz-live-leaderboard';
import { fetchQuizParticipantCount } from '@/services/quiz-participant-count';
import type { QuizLeaderboard } from '@/services/quiz-types';
import type { QuizV2LifecycleStatus } from '@/stores/quiz-recovery-envelope';

const FINAL_RETRY_INTERVAL_MS = 5_000;
const LIVE_REFRESH_INTERVAL_MS = 1_000;

interface UseQuizResultsLeaderboardInput {
  enabled: boolean;
  eventHasEnded: boolean;
  eventId: string | null;
  expectedUserId: string | null;
  lifecycle: QuizV2LifecycleStatus;
}

export function useQuizResultsLeaderboard({
  enabled,
  eventHasEnded,
  eventId,
  expectedUserId,
  lifecycle,
}: UseQuizResultsLeaderboardInput) {
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboard | null>(null);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const hasLeaderboard = useRef(false);
  const previousEventKey = useRef<string | null>(null);

  useEffect(() => {
    const eventKey = `${eventId ?? ''}:${expectedUserId ?? ''}`;
    const eventChanged = previousEventKey.current !== eventKey;
    if (eventChanged) {
      previousEventKey.current = eventKey;
      setLeaderboard(null);
      setParticipantCount(null);
      hasLeaderboard.current = false;
    }
    setLeaderboardError(false);
    if (!enabled || !eventId || !expectedUserId) return;

    let active = true;
    let appIsActive =
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive';
    let loadInFlight = false;
    let retryId: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delayMs: number) => {
      if (!active || !appIsActive) return;
      if (retryId) clearTimeout(retryId);
      retryId = setTimeout(() => {
        retryId = undefined;
        void load();
      }, delayMs);
    };
    const load = async () => {
      if (!active || !appIsActive || loadInFlight) return;
      loadInFlight = true;
      let retryDelayMs: number | null =
        lifecycle === 'pending_results'
          ? LIVE_REFRESH_INTERVAL_MS
          : FINAL_RETRY_INTERVAL_MS;
      try {
        const isLive = lifecycle === 'pending_results' && !eventHasEnded;
        const [result, liveParticipantCount] = await Promise.all([
          isLive
            ? fetchQuizLiveLeaderboard({ eventId, expectedUserId })
            : fetchQuizLeaderboard({ eventId, expectedUserId }),
          isLive
            ? fetchQuizParticipantCount({
                eventId,
                expectedUserId,
              }).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!active) return;
        setParticipantCount(liveParticipantCount ?? result.participantCount);
        if (result.status === 'published' || result.status === 'live') {
          setLeaderboard(result);
          hasLeaderboard.current = true;
          setLeaderboardError(false);
          if (result.status === 'live') {
            retryDelayMs = LIVE_REFRESH_INTERVAL_MS;
          } else {
            retryDelayMs = null;
          }
          return;
        }
      } catch {
        if (!active) return;
        if (!hasLeaderboard.current) setLeaderboardError(true);
      } finally {
        loadInFlight = false;
        if (retryDelayMs !== null) schedule(retryDelayMs);
      }
    };

    void load();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (retryId) clearTimeout(retryId);
      retryId = undefined;
      appIsActive = nextState === 'active';
      if (appIsActive) void load();
    });
    return () => {
      active = false;
      if (retryId) clearTimeout(retryId);
      subscription.remove();
    };
  }, [enabled, eventHasEnded, eventId, expectedUserId, lifecycle]);

  return { leaderboard, leaderboardError, participantCount };
}
