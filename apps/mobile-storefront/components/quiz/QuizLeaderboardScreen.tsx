import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fetchQuizEvents } from '@/services/quiz';
import { fetchQuizLeaderboard } from '@/services/quiz-leaderboard';
import type { QuizEvent, QuizLeaderboard } from '@/services/quiz-types';
import { useAuthStore } from '@/stores/auth-store';
import { createQuizLeaderboardStyles } from './QuizLeaderboardScreen.styles';
import { formatQuizClock } from './QuizScreen.utils';

export function QuizLeaderboardScreen() {
  const { colors } = useTheme();
  const styles = createQuizLeaderboardStyles(colors);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [events, setEvents] = useState<QuizEvent[]>([]);
  const [selected, setSelected] = useState<QuizEvent | null>(null);
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchQuizEvents()
      .then((items) => {
        if (!active) return;
        setEvents(
          items.filter((item) =>
            ['completed', 'closed', 'cancelled'].includes(item.status)
          )
        );
      })
      .catch(() => active && setError('Past leaderboards are unavailable.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const loadLeaderboard = async (event: QuizEvent) => {
    setSelected(event);
    setLeaderboard(null);
    setError(null);
    if (!userId) {
      setError('Sign in to view quiz leaderboards.');
      return;
    }
    setLoading(true);
    try {
      setLeaderboard(
        await fetchQuizLeaderboard({
          eventId: event.id,
          expectedUserId: userId,
        })
      );
    } catch {
      setError('This leaderboard is not available yet.');
    } finally {
      setLoading(false);
    }
  };

  const rows = leaderboard
    ? leaderboard.currentPlayer &&
      !leaderboard.entries.some((entry) => entry.isCurrentCustomer)
      ? [...leaderboard.entries, leaderboard.currentPlayer]
      : leaderboard.entries
    : [];

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={events}
        keyExtractor={(event) => event.id}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Choose a previous quiz to see the final standings.
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator accessibilityLabel="Loading past quiz leaderboards" />
          ) : (
            <Text style={styles.state}>No previous quiz leaderboards yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`View leaderboard for ${item.title}`}
            accessibilityRole="button"
            onPress={() => void loadLeaderboard(item)}
            style={[
              styles.eventButton,
              selected?.id === item.id ? styles.eventButtonSelected : undefined,
            ]}
          >
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventMeta}>
              {item.prizeName} · closed{' '}
              {formatQuizClock(item.endsAt, undefined, item.timeZone)}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.board}>
            {loading && events.length > 0 ? (
              <ActivityIndicator accessibilityLabel="Loading quiz leaderboard" />
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {selected && leaderboard?.status === 'published' ? (
              <>
                <Text accessibilityRole="header" style={styles.boardTitle}>
                  Final standings
                </Text>
                {rows.map((entry) => (
                  <View
                    key={`${entry.rank}-${entry.displayName}`}
                    accessibilityLabel={`Rank ${entry.rank}, ${entry.displayName}, score ${entry.score}`}
                    style={[
                      styles.rankRow,
                      entry.isCurrentCustomer
                        ? styles.currentRankRow
                        : undefined,
                    ]}
                  >
                    <Text style={styles.rank}>#{entry.rank}</Text>
                    <Text style={styles.name}>{entry.displayName}</Text>
                    <Text style={styles.score}>{entry.score} pts</Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        }
      />
    </View>
  );
}
