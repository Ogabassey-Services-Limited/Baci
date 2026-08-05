import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '@/hooks/useTheme';
import { createLogger } from '@/lib/logger';
import {
  fetchQuizEvents,
  type QuizIntegrityTier,
  submitQuizAnswer,
} from '@/services/quiz';
import { submitQuizAnswerV2 } from '@/services/quiz-attempts';
import { useAuthStore } from '@/stores/auth-store';
import { useQuizStore } from '@/stores/quiz-store';
import { QuizDateOfBirthGateModal } from './QuizDateOfBirthGateModal';
import { QuizEventsList } from './QuizEventsList';
import { QuizLiveQuestionCard } from './QuizLiveQuestionCard';
import { createQuizLobbyStyles } from './QuizLobby.styles';
import { QuizQuestionCard } from './QuizQuestionCard';
import { QuizResultsPanel } from './QuizResultsPanel';
import { createQuizStyles } from './QuizScreen.styles';
import { getQuizErrorMessage, shouldShowEventList } from './QuizScreen.utils';
import { QuizUsernameGateModal } from './QuizUsernameGateModal';
import { useQuizQuestionTimer } from './use-quiz-question-timer';
import { useQuizStartFlow } from './useQuizStartFlow';

const log = createLogger('Quiz');

const QUIZ_COPY = {
  actionFailed: 'Quiz action failed',
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
  const lobbyStyles = createQuizLobbyStyles(colors);
  const {
    status,
    events,
    attempt,
    v2Attempt,
    v2LifecycleStatus,
    v2Result,
    lockedOptionId,
    attemptIntegrityTier,
    selectedOptionId,
    result,
    error,
    loadEvents,
    startEvent,
    startEventV2,
    lockAndSubmitAnswer,
    selectAnswer,
    setError,
    submitSelectedAnswer,
    forfeitAnswer,
  } = useQuizStore(
    useShallow((state) => ({
      status: state.status,
      events: state.events,
      attempt: state.attempt,
      v2Attempt: state.v2Attempt,
      v2LifecycleStatus: state.v2LifecycleStatus,
      v2Result: state.v2Result,
      lockedOptionId: state.lockedOptionId,
      attemptIntegrityTier: state.attemptIntegrityTier,
      selectedOptionId: state.selectedOptionId,
      result: state.result,
      error: state.error,
      loadEvents: state.loadEvents,
      startEvent: state.startEvent,
      startEventV2: state.startEventV2,
      lockAndSubmitAnswer: state.lockAndSubmitAnswer,
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
  const { dobGate, requestStart, usernameGate } = useQuizStartFlow({
    events,
    integrityTier,
    startEvent,
    startEventV2: async (context, starter) => {
      // The store requires an identity to persist a recovery envelope. Keep a
      // missing session in the same visible v2 start path rather than letting
      // it escape as an unhandled rejection from the flow.
      if (!context.userId) {
        setError('Your session changed. Please try again.');
        return;
      }
      await startEventV2({ ...context, userId: context.userId }, starter);
    },
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

  const handleV2Answer = (optionId: string) => {
    const userId = useAuthStore.getState().user?.id;
    const question = v2Attempt?.question;
    if (!userId) {
      setError('Your session changed. Please try again.');
      return;
    }
    if (!v2Attempt || !question) {
      setError('No active quiz question is available. Please try again.');
      return;
    }
    void lockAndSubmitAnswer(optionId, (answer) =>
      submitQuizAnswerV2({
        answer,
        attemptId: v2Attempt.attemptId,
        clientAnsweredAt: new Date().toISOString(),
        expectedUserId: userId,
        questionId: question.id,
      })
    );
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
    <View style={styles.screen}>
      {status === 'loading' ? (
        <View style={styles.container}>
          <ActivityIndicator accessibilityLabel="Loading quiz events" />
        </View>
      ) : null}

      {error && !dobGate.isGateVisible ? (
        <View style={styles.container}>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          {status === 'ready' || status === 'error' ? (
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
        </View>
      ) : null}

      {shouldShowEventList(status) && events.length === 0 ? (
        <View style={styles.container}>
          <Text style={styles.eventMeta}>No quiz events available.</Text>
        </View>
      ) : null}

      {shouldShowEventList(status) && events.length > 0 ? (
        <QuizEventsList
          events={events}
          isStarting={status === 'starting'}
          locale={locale}
          onStart={requestStart}
          resumeEventId={v2Attempt?.eventId}
          serverNow={v2Attempt?.serverNow}
          styles={lobbyStyles}
        />
      ) : null}

      {(status === 'question' || status === 'submitting') && attempt ? (
        <View style={styles.container}>
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
        </View>
      ) : null}

      {(status === 'question' || status === 'submitting') && v2Attempt ? (
        <View style={styles.container}>
          <QuizLiveQuestionCard
            attempt={v2Attempt}
            lockedOptionId={lockedOptionId}
            onAnswer={handleV2Answer}
            styles={styles}
          />
        </View>
      ) : null}

      {status === 'result' ? (
        <QuizResultsPanel
          legacyResult={result}
          lifecycle={v2LifecycleStatus}
          styles={styles}
          v2Result={v2Result}
        />
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
    </View>
  );
}
