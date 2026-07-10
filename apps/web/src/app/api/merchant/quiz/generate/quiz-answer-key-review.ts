import { hashAnswerKey } from './quiz-answer-key';
import type { QuizSupabaseClient } from './quiz-generate-helpers';

type AnswerKeyReviewQuestion = {
  correctOptionId: string;
  position: number;
};

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function hasPersistedAnswerKeyReview(settings: unknown): boolean {
  if (!isSettingsRecord(settings)) return false;
  return (
    settings.answer_key_reviewed === true &&
    typeof settings.answer_key_reviewed_at === 'string' &&
    settings.answer_key_reviewed_at.trim().length > 0
  );
}

function createReviewedAnswerMap(
  questions: AnswerKeyReviewQuestion[]
): Map<number, string> | null {
  const reviewedAnswers = new Map<number, string>();
  for (const question of questions) {
    if (reviewedAnswers.has(question.position)) {
      return null;
    }
    reviewedAnswers.set(question.position, question.correctOptionId);
  }
  return reviewedAnswers;
}

export async function recordMerchantQuizAnswerKeyReview(
  supabase: QuizSupabaseClient,
  eventId: string,
  merchantId: string,
  questions: AnswerKeyReviewQuestion[]
): Promise<boolean> {
  const reviewedAnswers = createReviewedAnswerMap(questions);
  if (!reviewedAnswers) {
    return false;
  }

  // The stored answer_key_hash is NOT readable by authenticated users (it would
  // leak the answer key), so the comparison + settings write live in a
  // SECURITY DEFINER RPC. We only send hashes we compute here from the reviewed
  // answers, keyed by slot_index — never the answer key itself.
  const reviewedHashes: Record<string, string> = {};
  for (const [slotIndex, correctOptionId] of reviewedAnswers) {
    reviewedHashes[String(slotIndex)] = hashAnswerKey(correctOptionId);
  }

  const { data, error } = await supabase.rpc(
    'record_merchant_quiz_answer_key_review',
    {
      p_event_id: eventId,
      p_merchant_id: merchantId,
      p_reviewed: reviewedHashes,
    }
  );

  return !error && data === true;
}
