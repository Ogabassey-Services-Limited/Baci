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
  deadlineAt: string;
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

export type QuizPrizeCondition = 'new' | 'used' | 'open_box' | 'refurbished';

/**
 * Signed prize entitlement returned on a winning submission. Mirrors the web
 * `prizeClaim` contract; the mobile client redeems it by adding the prize
 * product to the cart with `voucherToken`/`awardId` attached (verified
 * server-side at order time).
 */
export interface QuizPrizeClaim {
  awardId: string;
  productId: string;
  variantId: string | null;
  condition: QuizPrizeCondition | null;
  voucherToken: string;
  cartPath: string;
}

export interface QuizResult {
  attemptId: string;
  status: 'completed' | 'in_progress';
  correctAnswers: number;
  totalQuestions: number;
  prizeEligible: boolean;
  prizeClaim?: QuizPrizeClaim;
  question?: QuizQuestion;
}

export interface QuizServiceOptions {
  baseUrl?: string;
}

export type QuizIntegrityTier = 'basic' | 'device' | 'strong';

export interface StartQuizAttemptInput extends QuizServiceOptions {
  /**
   * SHA-256 of the native install id. Lets the server share one attempt budget
   * across every account started from this device (anti multi-accounting).
   * Optional: a device that cannot produce one still plays.
   */
  deviceFingerprint?: string | null;
  eventId: string;
  /**
   * The signed-in shopper the caller intends to start for. The request is
   * refused if the resolved auth session belongs to a different user (an
   * account switch mid-request), so a stale start can't spend another
   * shopper's attempt.
   */
  expectedUserId?: string;
  integrityTier: QuizIntegrityTier;
}

export interface SubmitQuizAnswerInput extends QuizServiceOptions {
  attemptId: string;
  questionId: string;
  answer: string;
  integrityTier: QuizIntegrityTier;
  /**
   * ISO-8601 timestamp (with offset) captured when the player answered. The
   * server accepts it as an optional informational field for timing parity.
   */
  clientAnsweredAt?: string;
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
