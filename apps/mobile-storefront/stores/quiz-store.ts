import { create } from 'zustand';
import type {
  QuizAttempt,
  QuizEvent,
  QuizResult,
  StartQuizAttemptInput,
} from '@/services/quiz';
import { getFriendlyQuizErrorMessage } from '@/services/quiz-error-messages';
import { QuizServiceError } from '@/services/quiz-types';

type QuizStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'starting'
  | 'question'
  | 'submitting'
  | 'result'
  | 'error';
type QuizIntegrityTier = StartQuizAttemptInput['integrityTier'];

interface QuizStore {
  status: QuizStatus;
  events: QuizEvent[];
  selectedEventId: string | null;
  attempt: QuizAttempt | null;
  attemptIntegrityTier: QuizIntegrityTier | null;
  selectedOptionId: string | null;
  result: QuizResult | null;
  error: string | null;
  loadEvents: (loader: () => Promise<QuizEvent[]>) => Promise<void>;
  startEvent: (
    eventId: string,
    integrityTier: QuizIntegrityTier,
    starter: () => Promise<QuizAttempt>
  ) => Promise<void>;
  selectAnswer: (optionId: string) => void;
  submitSelectedAnswer: (submitter: () => Promise<QuizResult>) => Promise<void>;
  forfeitAnswer: (
    submitter: () => Promise<QuizResult>,
    retryOptionId?: string
  ) => Promise<void>;
  setError: (actionError: string) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as const,
  events: [],
  selectedEventId: null,
  attempt: null,
  attemptIntegrityTier: null,
  selectedOptionId: null,
  result: null,
  error: null,
};

function getMessage(error: unknown): string {
  // Known quiz codes (e.g. the new attempt-cap QZ030) render friendly copy.
  if (error instanceof QuizServiceError) {
    return getFriendlyQuizErrorMessage(error, 'Quiz request failed');
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  let serialized: string;
  try {
    serialized = JSON.stringify(error);
  } catch {
    serialized = String(error);
  }

  const runtimeType =
    error && typeof error === 'object'
      ? ((error as { constructor?: { name?: string } }).constructor?.name ??
        'Object')
      : typeof error;
  return `Quiz action failed (${runtimeType}: ${serialized})`;
}

/**
 * Compute the next store state from a submit response. Shared by the manual
 * submit and the timer forfeit paths so both handle recovered wins (which now
 * carry a `prizeClaim`) and next-question advancement identically.
 */
function computeNextSubmitState(
  currentAttempt: QuizAttempt | null,
  result: QuizResult
): Partial<QuizStore> {
  if (result.status === 'in_progress') {
    const nextQuestion = result.question;
    if (!nextQuestion || !currentAttempt) {
      return {
        status: 'error',
        error: 'Quiz response did not include the next question.',
      };
    }
    return {
      status: 'question',
      attempt: { ...currentAttempt, question: nextQuestion },
      selectedOptionId: null,
      result: null,
      error: null,
    };
  }

  // A completed response (including a recovered win with a prizeClaim) surfaces
  // the whole result object so the screen can render the claim affordance.
  return { status: 'result', result, error: null };
}

export const useQuizStore = create<QuizStore>((set, get) => {
  // Monotonic generation bumped by `reset()` (fired on sign-out / account
  // switch). An in-flight start, submit, or forfeit captures the generation
  // before it awaits; if a reset lands mid-flight, the awaited continuation is
  // dropped so the previous session's attempt, result, or `prizeClaim` can
  // never be written back into the freshly reset store (which would otherwise
  // let a signed-out or newly signed-in user see/claim the prior account's
  // attempt or prize).
  let stateGeneration = 0;

  async function performSubmit(submitter: () => Promise<QuizResult>) {
    const currentAttempt = get().attempt;
    // Synchronous in-flight guard: a manual tap and the timer auto-submit can
    // race; the first flips status to `submitting` before either awaits, so the
    // second bails here instead of firing a duplicate answer request.
    if (get().status === 'submitting') return;
    const generation = stateGeneration;
    set({ status: 'submitting', error: null });
    try {
      const result = await submitter();
      if (stateGeneration !== generation) return;
      set(computeNextSubmitState(currentAttempt, result));
    } catch (error) {
      if (stateGeneration !== generation) return;
      set({
        status: currentAttempt ? 'question' : 'ready',
        error: getMessage(error),
      });
    }
  }

  return {
    ...initialState,
    loadEvents: async (loader) => {
      set({ status: 'loading', error: null });
      try {
        const events = await loader();
        set({ status: 'ready', events, error: null });
      } catch (error) {
        set({ status: 'ready', error: getMessage(error) });
      }
    },
    startEvent: async (eventId, integrityTier, starter) => {
      // Synchronous in-flight guard against a double-tapped start button firing
      // two attempts (double point charge) before React disables the button.
      if (get().status === 'starting') return;
      // Capture the generation before awaiting: if `reset()` fires mid-flight
      // (sign-out / account switch), the awaited attempt must NOT be written
      // back into the freshly reset store — otherwise the next session briefly
      // sees the prior account's charged attempt/question and loyalty balance.
      const generation = stateGeneration;
      set({
        status: 'starting',
        attempt: null,
        selectedEventId: eventId,
        attemptIntegrityTier: integrityTier,
        selectedOptionId: null,
        result: null,
        error: null,
      });
      try {
        const attempt = await starter();
        if (stateGeneration !== generation) return;
        set({ status: 'question', attempt, error: null });
      } catch (error) {
        if (stateGeneration !== generation) return;
        set({ status: 'ready', error: getMessage(error) });
      }
    },
    selectAnswer: (optionId) => {
      const { status } = get();
      if (status === 'submitting') {
        set({ error: 'Answer is already being submitted.' });
        return;
      }
      if (status !== 'question') {
        set({ error: 'Cannot select answer outside question phase.' });
        return;
      }
      set({ error: null, selectedOptionId: optionId });
    },
    submitSelectedAnswer: async (submitter) => {
      if (!get().selectedOptionId) {
        set({ error: 'Select an answer before submitting.' });
        return;
      }
      await performSubmit(submitter);
    },
    // Timer-driven submit when the question window expires. Unlike the manual
    // path it does not require a selected option: the caller submits either the
    // current selection or a forfeit sentinel so the attempt still advances.
    forfeitAnswer: async (submitter, retryOptionId) => {
      if (!get().attempt) return;
      if (retryOptionId && !get().selectedOptionId) {
        // Preserve a timeout sentinel (or selected answer) so a failed
        // deadline submission can be retried after the timer has fired.
        set({ selectedOptionId: retryOptionId });
      }
      await performSubmit(submitter);
    },
    setError: (actionError) => {
      set({ status: 'error', error: actionError });
    },
    reset: () => {
      // Invalidate any in-flight submit/forfeit continuation before clearing so
      // its awaited result can't repopulate the store for the next session.
      stateGeneration += 1;
      set(initialState);
    },
  };
});
