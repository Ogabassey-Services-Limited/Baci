import type { QuizTerminalContext } from './quiz-recovery-envelope';

export function createQuizTerminalContext(
  attemptId: string,
  eventId: string,
  eventEndsAt?: string | null,
  serverNow?: string | null
): QuizTerminalContext {
  return {
    attemptId,
    eventId,
    eventEndsAt,
    serverNow,
    contractVersion: 2,
  };
}
