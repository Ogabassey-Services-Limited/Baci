export type QuizMode = 'prize' | 'practice';

export interface PracticeSessionIdSource {
  now?: () => number;
  counter?: () => number;
}

// Counter wraps at 1M; createPracticeSessionId includes a timestamp component so wrapped values remain unique across normal practice sessions.
const MAX_SESSION_COUNTER = 1_000_000;

export function makePracticeSessionCounter() {
  let counter = 0;

  return function nextPracticeSessionCounter() {
    // Bounded per JS runtime; the timestamp component keeps wrapped values unique across normal sessions.
    counter = (counter % MAX_SESSION_COUNTER) + 1;
    return counter;
  };
}

const nextDefaultPracticeSessionCounter = makePracticeSessionCounter();

export function createPracticeSessionId({
  now = Date.now,
  counter = nextDefaultPracticeSessionCounter,
}: PracticeSessionIdSource = {}) {
  return `practice-${now().toString(36)}-${counter().toString(36)}`;
}

export interface QuizIntegrityInput {
  mode: QuizMode;
  eventId: string;
  customerId: string | null;
  fingerprint: string | null;
  practiceSessionId?: string;
}

export type QuizIntegrityResult =
  | {
      ok: true;
      token: string;
      prizeEligible: boolean;
    }
  | {
      ok: false;
      reason: 'missing_prize_integrity';
    };

export function buildQuizIntegrityToken({
  mode,
  eventId,
  customerId,
  fingerprint,
  practiceSessionId,
}: QuizIntegrityInput): QuizIntegrityResult {
  const trimmedEventId = eventId.trim();
  const trimmedCustomerId = customerId?.trim() ?? '';
  const trimmedFingerprint = fingerprint?.trim() ?? '';

  if (
    !trimmedEventId ||
    (mode === 'prize' && (!trimmedCustomerId || !trimmedFingerprint))
  ) {
    return { ok: false, reason: 'missing_prize_integrity' };
  }

  const fallbackSessionId =
    practiceSessionId?.trim() || createPracticeSessionId();
  const identity =
    trimmedCustomerId || `practice-customer-${fallbackSessionId}`;
  const device = trimmedFingerprint || `practice-device-${fallbackSessionId}`;

  return {
    ok: true,
    token: [mode, trimmedEventId, identity, device]
      .map(encodeURIComponent)
      .join('|'),
    prizeEligible: mode === 'prize',
  };
}
