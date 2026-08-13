import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '@/hooks/useTheme';
import { getQuizDeviceFingerprint } from '@/lib/get-quiz-device-fingerprint';
import { createLogger } from '@/lib/logger';
import {
  fetchQuizEvents,
  type QuizIntegrityTier,
  submitQuizAnswer,
} from '@/services/quiz';
import { recoverActiveQuizAttempt } from '@/services/quiz-attempt-recovery';
import { submitQuizAnswerV2 } from '@/services/quiz-attempts';
import { useAuthStore } from '@/stores/auth-store';
import { useQuizStore } from '@/stores/quiz-store';
import { QuizDateOfBirthGateModal } from './QuizDateOfBirthGateModal';
import { QuizErrorPanel } from './QuizErrorPanel';
import { QuizEventsList } from './QuizEventsList';
import { QuizGameplayAdFooter } from './QuizGameplayAdFooter';
import { QuizLiveQuestionCard } from './QuizLiveQuestionCard';
import { createQuizLobbyStyles } from './QuizLobby.styles';
import { QuizMusicPlayer } from './QuizMusicPlayer';
import { QuizQuestionCard } from './QuizQuestionCard';
import { QuizResultsPanel } from './QuizResultsPanel';
import { createQuizStyles } from './QuizScreen.styles';
import { getQuizErrorMessage, shouldShowEventList } from './QuizScreen.utils';
import { QuizUsernameGateModal } from './QuizUsernameGateModal';
import { createQuizAnswerHandlers } from './quiz-answer-handlers';
import { useQuizEventTimer } from './use-quiz-event-timer';
import { useQuizQuestionTimer } from './use-quiz-question-timer';
import { useQuizResultPolling } from './use-quiz-result-polling';
import { useQuizServerClock } from './use-quiz-server-clock';
import { useQuizStartFlow } from './useQuizStartFlow';

const log = createLogger('Quiz');

const QUIZ_COPY = {
  actionFailed: 'Quiz action failed',
} as const;

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

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
    terminalContext,
    loadEvents,
    startEvent,
    startEventV2,
    lockAndSubmitAnswer,
    selectAnswer,
    setError,
    submitSelectedAnswer,
    forfeitAnswer,
    expireActiveEvent,
    retryLockedAnswer,
    setV2Result,
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
      terminalContext: state.terminalContext,
      loadEvents: state.loadEvents,
      startEvent: state.startEvent,
      startEventV2: state.startEventV2,
      lockAndSubmitAnswer: state.lockAndSubmitAnswer,
      selectAnswer: state.selectAnswer,
      setError: state.setError,
      submitSelectedAnswer: state.submitSelectedAnswer,
      forfeitAnswer: state.forfeitAnswer,
      expireActiveEvent: state.expireActiveEvent,
      retryLockedAnswer: state.retryLockedAnswer,
      setV2Result: state.setV2Result,
    }))
  );

  useQuizResultPolling({
    attemptId: terminalContext?.attemptId ?? null,
    enabled: status === 'result' && v2LifecycleStatus === 'pending_results',
    expectedUserId: useAuthStore.getState().user?.id ?? null,
    onResult: setV2Result,
  });

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

  const { dobGate, requestStart, usernameGate } = useQuizStartFlow({
    events,
    integrityTier,
    startEvent,
    startEventV2: async (context, starter) => {
      if (!context.userId) {
        setError('Your session changed. Please try again.');
        return;
      }
      await startEventV2({ ...context, userId: context.userId }, starter);
    },
  });

  const { handleSubmit, handleTimeExpired, handleV2Answer } =
    createQuizAnswerHandlers({
      attempt,
      attemptIntegrityTier,
      forfeitAnswer,
      getErrorMessage: getQuizErrorMessage,
      getUserId: () => useAuthStore.getState().user?.id,
      lockAndSubmitAnswer,
      logSubmitFailure: (error) =>
        log.warn('Failed to submit quiz answer', error),
      selectedOptionId,
      setError,
      status,
      submitLegacyAnswer: submitQuizAnswer,
      submitSelectedAnswer,
      submitV2Answer: submitQuizAnswerV2,
      v2Attempt,
    });

  const handleV2EventExpire = () => {
    const activeAttempt = v2Attempt;
    const userId = useAuthStore.getState().user?.id;
    if (!activeAttempt || !userId) return;
    void expireActiveEvent(async () =>
      recoverActiveQuizAttempt({
        deviceFingerprint: await getQuizDeviceFingerprint().catch(() => null),
        eventId: activeAttempt.eventId,
        expectedUserId: userId,
      })
    );
  };

  const handleV2Retry = () => {
    const activeAttempt = v2Attempt;
    const optionId = lockedOptionId;
    const userId = useAuthStore.getState().user?.id;
    const question = activeAttempt?.question;
    if (!activeAttempt || !question || !optionId || !userId) return;
    void retryLockedAnswer((answer) =>
      submitQuizAnswerV2({
        answer,
        attemptId: activeAttempt.attemptId,
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
    hasSelection: selectedOptionId !== null,
    onExpire: handleTimeExpired,
  });
  const musicEventEndsAt =
    v2Attempt?.eventEndsAt ?? terminalContext?.eventEndsAt ?? null;
  const musicServerNow =
    v2Attempt?.serverNow ?? terminalContext?.serverNow ?? null;
  const { offsetMs: musicClockOffsetMs } = useQuizServerClock(musicServerNow);
  const musicEventTimer = useQuizEventTimer({
    eventEndsAt: musicEventEndsAt,
    isActive: Boolean(musicEventEndsAt),
    onExpire: () => undefined,
    serverClockOffsetMs: musicClockOffsetMs,
  });
  const shouldPlayQuizMusic =
    (Boolean(v2Attempt) &&
      (status === 'question' || status === 'submitting')) ||
    (status === 'result' &&
      terminalContext?.contractVersion === 2 &&
      v2LifecycleStatus === 'pending_results');

  return (
    <View style={styles.screen}>
      {shouldPlayQuizMusic ? (
        <View style={styles.container}>
          <QuizMusicPlayer
            gameEndsIn={formatCountdown(musicEventTimer.remainingSeconds)}
          />
        </View>
      ) : null}
      {status === 'loading' ? (
        <View style={styles.container}>
          <ActivityIndicator accessibilityLabel="Loading quiz events" />
        </View>
      ) : null}

      {error && !dobGate.isGateVisible ? (
        <QuizErrorPanel
          description={error}
          onRetry={() => {
            void loadEvents(fetchQuizEvents);
          }}
          primaryColor={colors.primary}
          showRetry={status === 'ready' || status === 'error'}
          styles={styles}
        />
      ) : null}

      {!error && shouldShowEventList(status) ? (
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
          <QuizMusicPlayer />
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
            isSubmitting={status === 'submitting'}
            lockedOptionId={lockedOptionId}
            onAnswer={handleV2Answer}
            onEventExpire={handleV2EventExpire}
            onRetryLockedAnswer={handleV2Retry}
            styles={styles}
          />
        </View>
      ) : null}

      {status === 'result' ? (
        <QuizResultsPanel
          eventId={terminalContext?.eventId}
          eventEndsAt={terminalContext?.eventEndsAt}
          expectedUserId={useAuthStore.getState().user?.id ?? null}
          legacyResult={result}
          lifecycle={v2LifecycleStatus}
          serverNow={terminalContext?.serverNow}
          styles={styles}
          v2Result={v2Result}
        />
      ) : null}

      <QuizGameplayAdFooter
        active={status === 'question' || status === 'submitting'}
      />

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
          dobGate.confirmGate(dobGate.generation);
        }}
        visible={dobGate.isGateVisible}
      />
    </View>
  );
}
