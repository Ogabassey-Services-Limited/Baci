import Ionicons from '@react-native-vector-icons/ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  fetchQuizLeaderboard,
  fetchQuizLiveLeaderboard,
  fetchQuizParticipantCount,
} from '@/services/quiz-leaderboard';
import type {
  QuizLeaderboard,
  QuizLeaderboardEntry,
  QuizResult,
  QuizV2Result,
} from '@/services/quiz-types';
import type { QuizV2LifecycleStatus } from '@/stores/quiz-recovery-envelope';
import { QuizPrizeClaimPanel } from './QuizPrizeClaimPanel';
import type { createQuizStyles } from './QuizScreen.styles';
import { useQuizEventTimer } from './use-quiz-event-timer';
import { useQuizServerClock } from './use-quiz-server-clock';

type QuizStyles = ReturnType<typeof createQuizStyles>;
const LEADERBOARD_RETRY_INTERVAL_MS = 5_000;
const LIVE_LEADERBOARD_REFRESH_INTERVAL_MS = 1_000;

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function formatFinishTime(serverNow: string | null | undefined) {
  if (!serverNow) return null;
  const timestamp = Date.parse(serverNow);
  if (Number.isNaN(timestamp)) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}

interface QuizResultsPanelProps {
  eventId?: string | null;
  eventEndsAt?: string | null;
  expectedUserId?: string | null;
  legacyResult: QuizResult | null;
  lifecycle: QuizV2LifecycleStatus;
  serverNow?: string | null;
  styles: QuizStyles;
  v2Result: QuizV2Result | null;
}

export function QuizResultsPanel({
  eventId = null,
  eventEndsAt = null,
  expectedUserId = null,
  legacyResult,
  lifecycle,
  serverNow = null,
  styles,
  v2Result,
}: QuizResultsPanelProps) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboard | null>(null);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const { offsetMs } = useQuizServerClock(serverNow);
  const eventTimer = useQuizEventTimer({
    eventEndsAt,
    isActive: false,
    onExpire: () => undefined,
    serverClockOffsetMs: offsetMs,
  });
  const shouldLoadLeaderboard =
    (lifecycle === 'final' || lifecycle === 'pending_results') &&
    Boolean(eventId && expectedUserId);

  useEffect(() => {
    if (!shouldLoadLeaderboard || !eventId || !expectedUserId) return;
    let active = true;
    let retryId: ReturnType<typeof setTimeout> | undefined;
    setLeaderboardError(false);
    setParticipantCount(null);
    void fetchQuizParticipantCount({ eventId, expectedUserId })
      .then((count) => active && setParticipantCount(count))
      .catch(() => undefined);
    const load = async () => {
      try {
        const result =
          lifecycle === 'pending_results' && !eventTimer.hasEnded
            ? await fetchQuizLiveLeaderboard({ eventId, expectedUserId })
            : await fetchQuizLeaderboard({ eventId, expectedUserId });
        if (!active) return;
        if (result.status === 'published' || result.status === 'live') {
          setLeaderboard(result);
          setLeaderboardError(false);
          if (result.status === 'live') {
            retryId = setTimeout(load, LIVE_LEADERBOARD_REFRESH_INTERVAL_MS);
          }
          return;
        }
      } catch {
        if (!active) return;
        if (!leaderboard) setLeaderboardError(true);
      }
      retryId = setTimeout(
        load,
        lifecycle === 'pending_results'
          ? LIVE_LEADERBOARD_REFRESH_INTERVAL_MS
          : LEADERBOARD_RETRY_INTERVAL_MS
      );
    };
    void load();
    return () => {
      active = false;
      if (retryId) clearTimeout(retryId);
    };
  }, [eventId, expectedUserId, lifecycle, eventTimer.hasEnded, shouldLoadLeaderboard]);

  const leaderboardRows: QuizLeaderboardEntry[] = leaderboard
    ? leaderboard.currentPlayer &&
      !leaderboard.entries.some((entry) => entry.isCurrentCustomer)
      ? [...leaderboard.entries.slice(0, 4), leaderboard.currentPlayer]
      : leaderboard.entries.slice(0, 5)
    : [];
  const finishTime = formatFinishTime(serverNow);
  if (lifecycle !== 'idle') {
    const title =
      lifecycle === 'pending_results'
        ? "You're all done!"
        : lifecycle === 'event_cancelled'
          ? 'Quiz cancelled'
          : v2Result?.availability === 'final'
            ? `You placed #${v2Result.rank}`
            : 'Quiz complete';
    return (
      <View accessibilityRole="alert" style={styles.resultCard}>
        <View style={styles.resultIcon}>
          <Ionicons
            name={
              lifecycle === 'pending_results'
                ? 'checkmark-circle-outline'
                : 'trophy-outline'
            }
            size={28}
            color={styles.resultTitle.color}
          />
        </View>
        <Text style={styles.resultTitle}>{title}</Text>
        {v2Result?.availability === 'final' ? (
          <View style={styles.scoreSummary}>
            <Text style={styles.scoreValue}>{v2Result.score}</Text>
            <Text style={styles.scoreLabel}>
              points · {v2Result.totalQuestions} questions
            </Text>
          </View>
        ) : null}
        {lifecycle === 'pending_results' ? (
          <View style={styles.finishTimeCard}>
            <Text style={styles.finishTimeLabel}>You finished at</Text>
            <Text style={styles.finishTimeValue}>
              {finishTime ?? 'Recorded'}
            </Text>
            <Text style={styles.finishTimeHint}>
              Finish time will be used as a tie breaker
            </Text>
          </View>
        ) : (
          <Text style={styles.eventMeta}>Your quiz attempt is closed.</Text>
        )}
        {lifecycle === 'pending_results' ? (
          <Text style={styles.leaderboardCountdownLabel}>
            {eventTimer.hasEnded
              ? 'The quiz has closed and final results are being prepared.'
              : 'The leaderboard will appear when the quiz ends in'}
          </Text>
        ) : null}
        {lifecycle === 'pending_results' && !eventTimer.hasEnded ? (
          <Text accessibilityRole="timer" style={styles.leaderboardCountdown}>
            {formatCountdown(eventTimer.remainingSeconds)}
          </Text>
        ) : null}
        {shouldLoadLeaderboard ? (
          <View style={styles.finalStandings}>
            <View style={styles.finalStandingsHeader}>
              <View>
                <Text style={styles.finalStandingsTitle}>
                  {leaderboard?.status === 'published'
                    ? 'Final standings'
                    : 'Live standings'}
                </Text>
                {participantCount != null ? (
                  <Text style={styles.finalStandingsMeta}>
                    {participantCount}{' '}
                    {participantCount === 1 ? 'participant' : 'participants'}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="podium-outline"
                size={22}
                color={styles.finalStandingsTitle.color}
              />
            </View>
            {!leaderboard && !leaderboardError ? (
              <ActivityIndicator
                accessibilityLabel="Loading standings"
                color={styles.finalStandingsTitle.color}
              />
            ) : null}
            {leaderboardRows.map((entry) => (
              <View
                key={`${entry.rank}-${entry.displayName}`}
                accessibilityLabel={`Rank ${entry.rank}, ${entry.displayName}, score ${entry.score}`}
                style={[
                  styles.finalStandingRow,
                  entry.isCurrentCustomer
                    ? styles.finalStandingCurrentRow
                    : undefined,
                ]}
              >
                <Text style={styles.finalStandingRank}>#{entry.rank}</Text>
                <Text numberOfLines={1} style={styles.finalStandingName}>
                  {entry.displayName}
                  {entry.isCurrentCustomer ? '  (You)' : ''}
                </Text>
                <Text style={styles.finalStandingScore}>{entry.score} pts</Text>
              </View>
            ))}
            {leaderboardError && !leaderboard ? (
              <Text style={styles.eventMeta}>
                Standings are reconnecting. Your result is safely recorded.
              </Text>
            ) : null}
          </View>
        ) : null}
        {v2Result?.availability === 'final' ? (
          <>
            {v2Result.prizeClaim ? (
              <QuizPrizeClaimPanel
                prizeClaim={v2Result.prizeClaim}
                styles={styles}
              />
            ) : null}
            <View style={styles.resultActionBox}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View past quiz leaderboards"
                onPress={() => router.push('/quiz/leaderboards')}
                style={styles.resultAction}
              >
                <Text style={styles.secondaryButtonText}>
                  View past leaderboards
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={styles.secondaryButtonText.color}
                />
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    );
  }
  if (!legacyResult) return null;
  return (
    <View
      accessibilityLabel={`Quiz result: ${legacyResult.correctAnswers} of ${legacyResult.totalQuestions} correct`}
      accessibilityRole="alert"
      style={[styles.resultCard, { margin: 20 }]}
    >
      <Text style={styles.resultTitle}>Result</Text>
      <Text style={styles.resultScore}>
        {legacyResult.correctAnswers} of {legacyResult.totalQuestions} correct
      </Text>
      {legacyResult.prizeClaim ? (
        <QuizPrizeClaimPanel
          prizeClaim={legacyResult.prizeClaim}
          styles={styles}
        />
      ) : (
        <Text style={styles.eventMeta}>
          {legacyResult.prizeEligible
            ? 'Prize entry recorded'
            : 'Practice result only'}
        </Text>
      )}
    </View>
  );
}
