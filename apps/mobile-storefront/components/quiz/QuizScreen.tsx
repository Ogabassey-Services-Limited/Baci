import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import { lazy, Suspense, useEffect } from 'react';
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
import { useShallow } from 'zustand/react/shallow';
import { QuizEventsList } from './QuizEventsList';
import { createQuizStyles } from './QuizScreen.styles';
import {
  formatPointCount,
  getQuizErrorMessage,
  shouldShowEventList,
} from './QuizScreen.utils';
import { useQuizQuestionTimer } from './use-quiz-question-timer';

// Lazy-loaded so the winning-prize path's product/cart dependency graph is only
// required when a shopper actually wins — keeping the common quiz screen light.
const QuizPrizeClaimPanel = lazy(() =>
  import('./QuizPrizeClaimPanel').then((module) => ({
    default: module.QuizPrizeClaimPanel,
  }))
);

const log = createLogger('Quiz');

const QUIZ_COPY = {
  actionFailed: 'Quiz action failed',
  timeNotSet: 'Time not set',
} as const;

// Sentinel answer submitted when the question window closes with nothing
// selected. The server records an unmatched answer as incorrect and advances
// the attempt (the too-late path no longer fails), so the quiz never stalls.
const QUIZ_FORFEIT_ANSWER = '__timeout_no_answer__';
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
    forfeitAnswer,
  } = useQuizStore(
    useShallow((state) => ({
      status: state.status,
      events: state.events,
      attempt: state.attempt,
      attemptIntegrityTier: state.attemptIntegrityTier,
      selectedOptionId: state.selectedOptionId,
      result: state.result,
      error: state.error,
      loadEvents: state.loadEvents,
      startEvent: state.startEvent,
      selectAnswer: state.selectAnswer,
      setError: state.setError,
      submitSelectedAnswer: state.submitSelectedAnswer,
      forfeitAnswer: state.forfeitAnswer,
    }))
  );

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

  const submitAnswerValue = async (answer: string, viaForfeit: boolean) => {
    if (!attempt) return;

    const submitter = () =>
      submitQuizAnswer({
        answer,
        integrityTier: attemptIntegrityTier ?? 'basic',
        attemptId: attempt.attemptId,
        questionId: attempt.question.id,
        clientAnsweredAt: new Date().toISOString(),
      });

    try {
      await (viaForfeit
        ? forfeitAnswer(submitter)
        : submitSelectedAnswer(submitter));
    } catch (error) {
      log.warn('Failed to submit quiz answer', error);
      setError(getQuizErrorMessage(error, QUIZ_COPY.actionFailed));
    }
  };

  const handleSubmit = async () => {
    // Defensive guard: the submit button is disabled until these values exist.
    if (!attempt || !selectedOptionId) return;
    await submitAnswerValue(selectedOptionId, false);
  };

  // When the countdown reaches the auto-submit lead, submit the current
  // selection or a forfeit sentinel so the attempt always advances. The store's
  // in-flight guard makes this safe against a simultaneous manual submit.
  const handleTimeExpired = () => {
    if (!attempt || status !== 'question') return;
    void submitAnswerValue(selectedOptionId ?? QUIZ_FORFEIT_ANSWER, true);
  };

  const { remainingSeconds } = useQuizQuestionTimer({
    questionId: attempt?.question.id ?? null,
    timeLimitSeconds: attempt?.question.timeLimitSeconds ?? 0,
    isActive: status === 'question',
    onExpire: handleTimeExpired,
  });

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
            Super Quiz
          </Text>
          <Text style={styles.subtitle}>
            Use loyalty points to enter and answer for the rewards.
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

      {shouldShowEventList(status) && events.length === 0 ? (
        <Text style={styles.eventMeta}>No quiz events available.</Text>
      ) : null}

      {shouldShowEventList(status) && events.length > 0 ? (
        <QuizEventsList
          events={events}
          isStarting={status === 'starting'}
          locale={locale}
          onStart={(eventId) => {
            void handleStart(eventId);
          }}
          styles={styles}
          timeNotSetLabel={QUIZ_COPY.timeNotSet}
        />
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
          <Text
            accessibilityLabel={`Time left: ${remainingSeconds} seconds`}
            accessibilityLiveRegion="polite"
            style={styles.timer}
          >
            Time left: {remainingSeconds}s
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
              disabled={status === 'submitting'}
              accessibilityState={{
                disabled: status === 'submitting',
                selected: selectedOptionId === option.id,
              }}
              onPress={() => {
                selectAnswer(option.id);
              }}
              style={[
                styles.answerButton,
                selectedOptionId === option.id && styles.answerButtonSelected,
                status === 'submitting' && styles.answerButtonDisabled,
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
          {result.prizeClaim ? (
            <Suspense
              fallback={
                <ActivityIndicator accessibilityLabel="Preparing your prize" />
              }
            >
              <QuizPrizeClaimPanel
                prizeClaim={result.prizeClaim}
                styles={styles}
              />
            </Suspense>
          ) : (
            <Text style={styles.eventMeta}>
              {result.prizeEligible
                ? 'Prize entry recorded'
                : 'Practice result only'}
            </Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
