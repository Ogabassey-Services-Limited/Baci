import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import coinsImage from '@/assets/quiz/png/Coins.png';
import { useTheme } from '@/hooks/useTheme';
import { createLogger } from '@/lib/logger';
import {
  fetchQuizEvents,
  type QuizIntegrityTier,
  submitQuizAnswer,
} from '@/services/quiz';
import { useQuizStore } from '@/stores/quiz-store';
import { QuizDateOfBirthGateModal } from './QuizDateOfBirthGateModal';
import { QuizEventsList } from './QuizEventsList';
import { QuizPrizeClaimPanel } from './QuizPrizeClaimPanel';
import { QuizQuestionCard } from './QuizQuestionCard';
import { createQuizStyles } from './QuizScreen.styles';
import { getQuizErrorMessage, shouldShowEventList } from './QuizScreen.utils';
import { QuizUsernameGateModal } from './QuizUsernameGateModal';
import { useQuizQuestionTimer } from './use-quiz-question-timer';
import { useQuizStartFlow } from './useQuizStartFlow';

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

  // Composes the username + 18+ date-of-birth gates and the attempt start,
  // including reopening the DOB gate when the server age gate rejects a stored
  // value.
  const { dobGate, usernameGate } = useQuizStartFlow({
    integrityTier,
    startEvent,
  });

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
        ? forfeitAnswer(submitter, answer)
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
    deadlineAt: attempt?.question.deadlineAt,
    isActive: status === 'question',
    // A selected answer auto-submits early to beat latency; with no selection
    // the forfeit waits for the real deadline so the player keeps their final
    // seconds.
    hasSelection: selectedOptionId !== null,
    onExpire: handleTimeExpired,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>
            Super Quiz
          </Text>
          <Text style={styles.subtitle}>
            Free to enter — answer the questions and play for the rewards.
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
        <Text style={styles.introTitle}>Entry</Text>
        <Text style={styles.introText}>Free to enter.</Text>
        <Text style={styles.introMeta}>
          No loyalty points required. No purchase necessary.
        </Text>
      </View>

      {status === 'loading' ? (
        <ActivityIndicator accessibilityLabel="Loading quiz events" />
      ) : null}

      {error && !dobGate.isGateVisible ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {error &&
      !dobGate.isGateVisible &&
      (status === 'ready' || status === 'error') ? (
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
          onStart={usernameGate.requestStart}
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
          remainingSeconds={remainingSeconds}
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
          {result.prizeClaim ? (
            <QuizPrizeClaimPanel
              prizeClaim={result.prizeClaim}
              styles={styles}
            />
          ) : (
            <Text style={styles.eventMeta}>
              {result.prizeEligible
                ? 'Prize entry recorded'
                : 'Practice result only'}
            </Text>
          )}
        </View>
      ) : null}

      <QuizUsernameGateModal
        onCancel={usernameGate.cancelGate}
        onSuccess={() => {
          usernameGate.confirmGate();
        }}
        visible={usernameGate.isGateVisible}
      />
      <QuizDateOfBirthGateModal
        errorMessage={dobGate.correctionError}
        initialValue={
          dobGate.correctionError
            ? (dobGate.dateOfBirth ?? undefined)
            : undefined
        }
        onCancel={dobGate.cancelGate}
        onSuccess={() => {
          // Pass the generation snapshotted at open time so a save that resolved
          // after the gate was cancelled/reopened cannot start the wrong event.
          dobGate.confirmGate(dobGate.generation);
        }}
        visible={dobGate.isGateVisible}
      />
    </ScrollView>
  );
}
