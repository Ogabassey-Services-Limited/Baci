import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import coinsImage from '@/assets/quiz/png/Coins.png';
import { useTheme } from '@/hooks/useTheme';
import { createLogger } from '@/lib/logger';
import {
  fetchQuizEvents,
  type QuizIntegrityTier,
  startQuizAttempt,
  submitQuizAnswer,
} from '@/services/quiz';
import { useQuizStore } from '@/stores/quiz-store';
import { createQuizStyles } from './QuizScreen.styles';
import {
  formatPointCount,
  formatTimeRange,
  getEventStartButtonText,
  getQuizErrorMessage,
} from './QuizScreen.utils';

const log = createLogger('Quiz');

const QUIZ_COPY = {
  actionFailed: 'Quiz action failed',
  timeNotSet: 'Time not set',
} as const;

interface QuizScreenProps {
  integrityTier?: QuizIntegrityTier;
  locale?: string;
}

export function QuizScreen({
  integrityTier = 'basic',
  locale,
}: QuizScreenProps = {}) {
  const { colors } = useTheme();
  const styles = createQuizStyles(colors);
  const {
    status,
    events,
    attempt,
    attemptIntegrityTier,
    selectedOptionId,
    result,
    error,
    loadEvents,
    startEvent,
    selectAnswer,
    setError,
    submitSelectedAnswer,
  } = useQuizStore();

  useEffect(() => {
    let mounted = true;
    if (status === 'idle') {
      loadEvents(fetchQuizEvents).catch((error) => {
        log.warn('Failed to load quiz events', error);
        if (mounted) {
          setError(getQuizErrorMessage(error, QUIZ_COPY.actionFailed));
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [loadEvents, setError, status]);

  const handleStart = async (eventId: string) => {
    try {
      await startEvent(eventId, integrityTier, () =>
        startQuizAttempt({ eventId, integrityTier })
      );
    } catch (error) {
      log.warn('Failed to start quiz attempt', error);
      setError(getQuizErrorMessage(error, QUIZ_COPY.actionFailed));
    }
  };

  const handleSubmit = async () => {
    // Defensive guard: the submit button is disabled until these values exist.
    if (!attempt || !selectedOptionId) return;

    try {
      await submitSelectedAnswer(() =>
        submitQuizAnswer({
          answer: selectedOptionId,
          integrityTier: attemptIntegrityTier ?? 'basic',
          attemptId: attempt.attemptId,
          questionId: attempt.question.id,
        })
      );
    } catch (error) {
      log.warn('Failed to submit quiz answer', error);
      setError(getQuizErrorMessage(error, QUIZ_COPY.actionFailed));
    }
  };

  const questionProgressPercent = attempt
    ? Math.min(
        100,
        Math.max(
          0,
          (attempt.question.index / Math.max(1, attempt.question.total)) * 100
        )
      )
    : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>
            Prize Exam
          </Text>
          <Text style={styles.subtitle}>
            Use loyalty points to enter and answer for the prize.
          </Text>
        </View>
        <Image
          source={coinsImage}
          style={styles.headerImage}
          accessibilityIgnoresInvertColors
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      <View style={styles.introPanel}>
        <Text style={styles.introTitle}>Exam pass</Text>
        <Text style={styles.introText}>
          Use {formatPointCount(EXAM_PASS_POINTS_COST, 'loyalty point')} as your
          exam pass.
        </Text>
        <Text style={styles.introMeta}>
          Your pass is charged when the exam starts.
        </Text>
      </View>

      {status === 'loading' ? (
        <ActivityIndicator accessibilityLabel="Loading quiz events" />
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {error && (status === 'ready' || status === 'error') ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading quiz events"
          onPress={() => {
            void loadEvents(fetchQuizEvents);
          }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      ) : null}

      {(status === 'ready' || status === 'starting') && events.length === 0 ? (
        <Text style={styles.eventMeta}>No quiz events available.</Text>
      ) : null}

      {(status === 'ready' || status === 'starting') && events.length > 0 ? (
        <View
          accessibilityRole="list"
          accessibilityLabel="Available quiz events"
        >
          {events.map((event) => (
            <View
              key={event.id}
              accessibilityLabel={`Quiz event ${event.title}, prize ${event.prizeName}`}
              style={styles.eventCard}
            >
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventPrize}>{event.prizeName}</Text>
              <Text style={styles.eventMeta}>
                {event.questionCount} questions,{' '}
                {formatTimeRange(event, locale, QUIZ_COPY.timeNotSet)},{' '}
                {formatPointCount(EXAM_PASS_POINTS_COST, 'loyalty point')} exam
                pass
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${getEventStartButtonText(event.status, status === 'starting', EXAM_PASS_POINTS_COST)} ${event.title}`}
                accessibilityState={{ disabled: status === 'starting' || event.status !== 'open' }}
                disabled={status === 'starting' || event.status !== 'open'}
                onPress={() => {
                  if (status !== 'starting' && event.status === 'open') void handleStart(event.id);
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {getEventStartButtonText(event.status, status === 'starting', EXAM_PASS_POINTS_COST)}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {(status === 'question' || status === 'submitting') && attempt ? (
        <View style={styles.questionCard}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Question ${attempt.question.index} of ${attempt.question.total}`}
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
                {
                  width: `${questionProgressPercent}%`,
                },
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
              accessibilityRole="button"
              accessibilityLabel={`Answer ${option.label}`}
              accessibilityState={{
                selected: selectedOptionId === option.id,
              }}
              onPress={() => {
                selectAnswer(option.id);
              }}
              style={[
                styles.answerButton,
                selectedOptionId === option.id && styles.answerButtonSelected,
              ]}
            >
              <Text style={styles.answerText}>{option.label}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit answer"
            accessibilityState={{
              disabled: !selectedOptionId || status === 'submitting',
            }}
            disabled={!selectedOptionId || status === 'submitting'}
            onPress={() => {
              void handleSubmit();
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Submit answer</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'result' && result ? (
        <View
          accessibilityRole="alert"
          accessibilityLabel={`Quiz result: ${result.correctAnswers} of ${result.totalQuestions} correct`}
          style={styles.resultCard}
        >
          <Text style={styles.resultTitle}>Result</Text>
          <Text style={styles.resultScore}>
            {result.correctAnswers} of {result.totalQuestions} correct
          </Text>
          <Text style={styles.eventMeta}>
            {result.prizeEligible
              ? 'Prize entry recorded'
              : 'Practice result only'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
