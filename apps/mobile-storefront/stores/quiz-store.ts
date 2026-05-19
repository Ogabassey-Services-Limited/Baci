import { create } from 'zustand';
import type {
  QuizAttempt,
  QuizEvent,
  QuizResult,
  StartQuizAttemptInput,
} from '@/services/quiz';

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
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  let serialized = '';
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

export const useQuizStore = create<QuizStore>((set, get) => ({
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
      set({ status: 'question', attempt, error: null });
    } catch (error) {
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
    const { attempt: currentAttempt, selectedOptionId } = get();
    if (!selectedOptionId) {
      set({ error: 'Select an answer before submitting.' });
      return;
    }

    set({ status: 'submitting', error: null });
    try {
      const result = await submitter();
      if (result.status === 'in_progress') {
        const nextQuestion = result.question;
        if (!nextQuestion || !currentAttempt) {
          set({
            status: 'error',
            error: 'Quiz response did not include the next question.',
          });
          return;
        }
        set({
          status: 'question',
          attempt: { ...currentAttempt, question: nextQuestion },
          selectedOptionId: null,
          result: null,
          error: null,
        });
        return;
      }

      set({ status: 'result', result, error: null });
    } catch (error) {
      set({
        status: currentAttempt ? 'question' : 'ready',
        error: getMessage(error),
      });
    }
  },
  setError: (actionError) => {
    set({ status: 'error', error: actionError });
  },
  reset: () => set(initialState),
}));
