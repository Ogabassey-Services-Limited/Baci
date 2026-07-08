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
import { useShallow } from 'zustand/react/shallow';
import { QuizEventsList } from './QuizEventsList';
import { QuizQuestionCard } from './QuizQuestionCard';
import { createQuizStyles } from './QuizScreen.styles';
import {
  formatPointCount,
  getQuizErrorMessage,
  shouldShowEventList,
} from './QuizScreen.utils';
import { QuizUsernameGateModal } from './QuizUsernameGateModal';
import { useQuizStartGate } from './useQuizStartGate';

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

  const { cancelGate, confirmGate, isGateVisible, requestStart } =
    useQuizStartGate((eventId) => {
      void handleStart(eventId);
    });

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
          onStart={requestStart}
          styles={styles}
          timeNotSetLabel={QUIZ_COPY.timeNotSet}
        />
      ) : null}

      {(status === 'question' || status === 'submitting') && attempt ? (
        <QuizQuestionCard
          attempt={attempt}
          isSubmitting={status === 'submitting'}
          onSelectAnswer={selectAnswer}
          onSubmit={() => {
            void handleSubmit();
          }}
          selectedOptionId={selectedOptionId}
          styles={styles}
        />
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

      <QuizUsernameGateModal
        onCancel={cancelGate}
        onSuccess={() => {
          confirmGate();
        }}
        visible={isGateVisible}
      />
    </ScrollView>
  );
}
