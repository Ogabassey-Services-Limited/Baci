import type {
  QuizActiveAttemptResponse,
  QuizV2Attempt,
} from '@/services/quiz-types';
import type { QuizV2StoreAccess } from './quiz-v2-store-access';

interface CreateQuizV2ExpiryActionInput {
  access: QuizV2StoreAccess;
  applyRecoveryResponse: (
    response: QuizActiveAttemptResponse,
    fallback: QuizV2Attempt
  ) => Promise<void>;
  getLifecycleEpoch: () => number;
  nextLifecycleEpoch: () => number;
}

export function createQuizV2ExpiryAction({
  access,
  applyRecoveryResponse,
  getLifecycleEpoch,
  nextLifecycleEpoch,
}: CreateQuizV2ExpiryActionInput) {
  let expiryInFlight = false;

  return async (reconciler: () => Promise<QuizActiveAttemptResponse>) => {
    const attempt = access.get().v2Attempt;
    if (
      expiryInFlight ||
      !attempt ||
      !['question', 'submitting'].includes(access.get().status)
    )
      return;
    expiryInFlight = true;
    const generation = access.getGeneration();
    const expiryEpoch = nextLifecycleEpoch();
    access.set({ error: null, expiryRetryable: false });
    try {
      const response = await reconciler();
      if (
        generation !== access.getGeneration() ||
        expiryEpoch !== getLifecycleEpoch()
      )
        return;
      await applyRecoveryResponse(response, attempt);
    } catch (error) {
      if (generation === access.getGeneration())
        access.set({
          expiryRetryable: true,
          status: 'question',
          error: access.getMessage(error),
        });
    } finally {
      expiryInFlight = false;
    }
  };
}
