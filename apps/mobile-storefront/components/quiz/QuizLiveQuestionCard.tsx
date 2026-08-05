import { Pressable, Text, View } from 'react-native';
import type { QuizV2Attempt } from '@/services/quiz-types';
import type { createQuizStyles } from './QuizScreen.styles';
import { useQuizEventTimer } from './use-quiz-event-timer';
import { useQuizQuestionTimer } from './use-quiz-question-timer';
import { calculateQuizServerClockOffset } from './use-quiz-server-clock';

type QuizStyles = ReturnType<typeof createQuizStyles>;

interface QuizLiveQuestionCardProps {
  attempt: QuizV2Attempt;
  lockedOptionId: string | null;
  onAnswer: (optionId: string) => void;
  styles: QuizStyles;
}

export function QuizLiveQuestionCard({
  attempt,
  lockedOptionId,
  onAnswer,
  styles,
}: QuizLiveQuestionCardProps) {
  const question = attempt.question;
  const offsetMs = calculateQuizServerClockOffset(attempt.serverNow);
  const eventTimer = useQuizEventTimer({
    eventEndsAt: attempt.eventEndsAt,
    isActive: attempt.status === 'in_progress',
    onExpire: () => undefined,
    serverClockOffsetMs: offsetMs,
  });
  const questionTimer = useQuizQuestionTimer({
    deadlineAt: question?.deadlineAt,
    hasSelection: lockedOptionId !== null,
    isActive: attempt.status === 'in_progress' && Boolean(question),
    onExpire: () => onAnswer('__timeout_no_answer__'),
    questionId: question?.id ?? null,
    timeLimitSeconds: question?.timeLimitSeconds ?? 0,
  });

  if (!question) return null;

  return (
    <View style={styles.questionCard}>
      <View
        accessibilityLabel={`Question ${question.index} of ${question.total}`}
        accessibilityRole="progressbar"
        accessibilityValue={{
          max: question.total,
          min: 1,
          now: question.index,
        }}
      >
        <Text style={styles.eventMeta}>
          Question {question.index} of {question.total}
        </Text>
      </View>
      <Text accessibilityRole="timer" style={styles.timer}>
        {questionTimer.remainingSeconds}s · quiz closes in{' '}
        {eventTimer.remainingSeconds}s
      </Text>
      <Text style={styles.question}>{question.prompt}</Text>
      {question.options.map((option) => {
        const selected = lockedOptionId === option.id;
        const disabled = lockedOptionId !== null;
        return (
          <Pressable
            key={option.id}
            accessibilityLabel={`Answer ${option.label}`}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={() => onAnswer(option.id)}
            style={[
              styles.answerButton,
              selected ? styles.answerButtonSelected : undefined,
              disabled ? styles.answerButtonDisabled : undefined,
            ]}
          >
            <Text style={styles.answerText}>{option.label}</Text>
          </Pressable>
        );
      })}
      <Text style={styles.passReceipt}>Your answer locks when tapped.</Text>
    </View>
  );
}
