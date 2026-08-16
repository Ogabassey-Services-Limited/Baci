import type {
  QuizEvent,
  QuizResult,
  QuizV2Result,
} from '@/services/quiz-types';
import type {
  QuizTerminalContext,
  QuizV2LifecycleStatus,
} from '@/stores/quiz-recovery-envelope';
import { QuizResultsPanel } from './QuizResultsPanel';
import type { createQuizStyles } from './QuizScreen.styles';
import { canPlayAnotherQuizAttempt } from './QuizScreen.utils';

type QuizStyles = ReturnType<typeof createQuizStyles>;

interface QuizResultRouteProps {
  dismissRecovery: (eventId: string) => void;
  events: QuizEvent[];
  expectedUserId: string | null;
  lifecycle: QuizV2LifecycleStatus;
  onReset: () => void;
  onRetryRecovery: () => void;
  result: QuizResult | null;
  styles: QuizStyles;
  terminalContext: QuizTerminalContext | null;
  v2Result: QuizV2Result | null;
}

export function QuizResultRoute({
  dismissRecovery,
  events,
  expectedUserId,
  lifecycle,
  onReset,
  onRetryRecovery,
  result,
  styles,
  terminalContext,
  v2Result,
}: QuizResultRouteProps) {
  const event = events.find(
    (candidate) => candidate.id === terminalContext?.eventId
  );
  const canPlayAgain = canPlayAnotherQuizAttempt(
    event,
    terminalContext?.serverNow
  );
  return (
    <QuizResultsPanel
      allowPendingResultsExit={canPlayAgain}
      eventId={terminalContext?.eventId}
      eventEndsAt={terminalContext?.eventEndsAt}
      expectedUserId={expectedUserId}
      legacyResult={result}
      lifecycle={lifecycle}
      onReturnToQuizList={() => {
        if (
          lifecycle === 'pending_results' &&
          canPlayAgain &&
          terminalContext?.eventId
        ) {
          dismissRecovery(terminalContext.eventId);
        }
        onReset();
        onRetryRecovery();
      }}
      serverNow={terminalContext?.serverNow}
      styles={styles}
      v2Result={v2Result}
    />
  );
}
