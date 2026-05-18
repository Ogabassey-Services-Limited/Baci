import type { QuizAttempt, QuizEvent, QuizResult } from '@/services/quiz';

export const events: QuizEvent[] = [
  {
    id: 'event-1',
    title: 'Daily Prize Quiz',
    prizeName: 'N50,000 store credit',
    startsAt: '2026-05-20T10:00:00.000Z',
    endsAt: '2026-05-20T10:10:00.000Z',
    status: 'open',
    questionCount: 1,
  },
];

export const attempt: QuizAttempt = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 1,
  remainingLoyaltyPoints: 4,
  question: {
    id: 'question-1',
    prompt: 'Pick the answer',
    options: [
      { id: 'a', label: 'First' },
      { id: 'b', label: 'Second' },
    ],
    timeLimitSeconds: 30,
    index: 1,
    total: 1,
  },
};

export const result: QuizResult = {
  attemptId: 'attempt-1',
  status: 'completed',
  correctAnswers: 1,
  totalQuestions: 1,
  prizeEligible: true,
};

export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
