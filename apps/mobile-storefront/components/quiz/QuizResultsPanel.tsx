import { Text, View } from 'react-native';
import type { QuizResult, QuizV2Result } from '@/services/quiz-types';
import type { QuizV2LifecycleStatus } from '@/stores/quiz-recovery-envelope';
import { QuizPrizeClaimPanel } from './QuizPrizeClaimPanel';
import type { createQuizStyles } from './QuizScreen.styles';

type QuizStyles = ReturnType<typeof createQuizStyles>;

interface QuizResultsPanelProps {
  legacyResult: QuizResult | null;
  lifecycle: QuizV2LifecycleStatus;
  styles: QuizStyles;
  v2Result: QuizV2Result | null;
}

export function QuizResultsPanel({
  legacyResult,
  lifecycle,
  styles,
  v2Result,
}: QuizResultsPanelProps) {
  if (lifecycle !== 'idle') {
    const title =
      lifecycle === 'pending_results'
        ? 'Results are being finalized'
        : lifecycle === 'event_cancelled'
          ? 'Quiz cancelled'
          : v2Result?.availability === 'final'
            ? `You placed #${v2Result.rank}`
            : 'Quiz complete';
    return (
      <View
        accessibilityRole="alert"
        style={[styles.resultCard, { margin: 20 }]}
      >
        <Text style={styles.resultTitle}>{title}</Text>
        <Text style={styles.eventMeta}>
          {lifecycle === 'pending_results'
            ? 'Your answers are saved. Check the leaderboard shortly.'
            : 'Your quiz attempt is closed.'}
        </Text>
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
