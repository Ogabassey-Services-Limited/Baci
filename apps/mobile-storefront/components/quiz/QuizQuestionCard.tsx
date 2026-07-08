import { Pressable, Text, View } from 'react-native';
import type { QuizAttempt } from '@/services/quiz';
import type { createQuizStyles } from './QuizScreen.styles';
import { formatPointCount } from './QuizScreen.utils';

type QuizStyles = ReturnType<typeof createQuizStyles>;

interface QuizQuestionCardProps {
  attempt: QuizAttempt;
  isSubmitting: boolean;
  onSelectAnswer: (optionId: string) => void;
  onSubmit: () => void;
  selectedOptionId: string | null;
  styles: QuizStyles;
}

export function QuizQuestionCard({
  attempt,
  isSubmitting,
  onSelectAnswer,
  onSubmit,
  selectedOptionId,
  styles,
}: QuizQuestionCardProps) {
  const questionProgressPercent = Math.min(
    100,
    Math.max(
      0,
      (attempt.question.index / Math.max(1, attempt.question.total)) * 100
    )
  );

  return (
    <View style={styles.questionCard}>
      <View
        accessibilityLabel={`Question ${attempt.question.index} of ${attempt.question.total}`}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 1,
          max: Math.max(1, attempt.question.total),
          now: attempt.question.index,
        }}
        style={styles.progressTrack}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${questionProgressPercent}%` },
          ]}
        />
      </View>
      <Text style={styles.timer}>
        You have {attempt.question.timeLimitSeconds}s per question
      </Text>
      <Text style={styles.passReceipt}>
        {formatPointCount(attempt.examPassPointsSpent)} exam pass used.{' '}
        {formatPointCount(attempt.remainingLoyaltyPoints)} left.
      </Text>
      <Text accessibilityRole="header" style={styles.question}>
        {attempt.question.prompt}
      </Text>
      {attempt.question.options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityLabel={`Answer ${option.label}`}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isSubmitting,
            selected: selectedOptionId === option.id,
          }}
          disabled={isSubmitting}
          onPress={() => {
            onSelectAnswer(option.id);
          }}
          style={[
            styles.answerButton,
            selectedOptionId === option.id && styles.answerButtonSelected,
            isSubmitting && styles.answerButtonDisabled,
          ]}
        >
          <Text style={styles.answerText}>{option.label}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityLabel="Submit answer"
        accessibilityRole="button"
        accessibilityState={{
          disabled: !selectedOptionId || isSubmitting,
        }}
        disabled={!selectedOptionId || isSubmitting}
        onPress={onSubmit}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Submit answer</Text>
      </Pressable>
    </View>
  );
}
