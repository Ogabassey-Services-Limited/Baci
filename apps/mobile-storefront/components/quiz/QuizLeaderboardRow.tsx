import { Text, View } from 'react-native';
import type { QuizLeaderboardEntry } from '@/services/quiz-types';
import type { createQuizLeaderboardStyles } from './QuizLeaderboardScreen.styles';

interface QuizLeaderboardRowProps {
  entry: QuizLeaderboardEntry;
  styles: ReturnType<typeof createQuizLeaderboardStyles>;
}

export function QuizLeaderboardRow({ entry, styles }: QuizLeaderboardRowProps) {
  return (
    <View
      accessibilityLabel={`Rank ${entry.rank}, ${entry.displayName}, score ${entry.score}`}
      style={[
        styles.rankRow,
        entry.rank <= 3 ? styles.podiumRow : undefined,
        entry.isCurrentCustomer ? styles.currentRankRow : undefined,
      ]}
    >
      <Text
        style={[styles.rank, entry.rank <= 3 ? styles.podiumRank : undefined]}
      >
        #{entry.rank}
      </Text>
      <Text numberOfLines={1} style={styles.name}>
        {entry.displayName}
      </Text>
      <Text style={styles.score}>{entry.score} pts</Text>
    </View>
  );
}
