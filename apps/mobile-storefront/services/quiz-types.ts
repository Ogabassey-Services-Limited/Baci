export type QuizEventStatus = 'open' | 'scheduled' | 'closed';

export interface QuizEvent {
  id: string;
  title: string;
  prizeName: string;
  startsAt: string | null;
  endsAt: string | null;
  status: QuizEventStatus;
  questionCount: number;
}

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  timeLimitSeconds: number;
  index: number;
  total: number;
}

export interface QuizAttempt {
  attemptId: string;
  eventId: string;
  examPassPointsSpent: number;
  remainingLoyaltyPoints: number;
  question: QuizQuestion;
}

export interface QuizResult {
  attemptId: string;
  status: 'completed' | 'in_progress';
  correctAnswers: number;
  totalQuestions: number;
  prizeEligible: boolean;
  question?: QuizQuestion;
}

export interface QuizServiceOptions {
  baseUrl?: string;
}

export type QuizIntegrityTier = 'basic' | 'device' | 'strong';

export interface StartQuizAttemptInput extends QuizServiceOptions {
  eventId: string;
  integrityTier: QuizIntegrityTier;
}

export interface SubmitQuizAnswerInput extends QuizServiceOptions {
  attemptId: string;
  questionId: string;
  answer: string;
  integrityTier: QuizIntegrityTier;
}

type ErrorConstructorWithStackTrace = typeof Error & {
  captureStackTrace?: (
    targetObject: object,
    constructorOpt?: typeof QuizServiceError
  ) => void;
};

export class QuizServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'QuizServiceError';
    Object.setPrototypeOf(this, QuizServiceError.prototype);
    this.code = code;
    this.status = status;

    const captureStackTrace = (Error as ErrorConstructorWithStackTrace)
      .captureStackTrace;
    captureStackTrace?.(this, QuizServiceError);
  }
}
