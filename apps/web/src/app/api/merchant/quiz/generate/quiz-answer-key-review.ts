import { hashAnswerKey } from './quiz-answer-key';
import type { QuizSupabaseClient } from './quiz-generate-helpers';

type AnswerKeyReviewQuestion = {
  correctOptionId: string;
  position: number;
};

type QuizAnswerKeyReviewVariantRow = {
  active?: boolean | null;
  answer_key_hash?: string | null;
};

type QuizAnswerKeyReviewSlotRow = {
  quiz_question_variants?: QuizAnswerKeyReviewVariantRow[] | null;
  slot_index?: number | null;
};

type QuizAnswerKeyReviewEventRow = {
  quiz_question_slots?: QuizAnswerKeyReviewSlotRow[] | null;
  settings?: unknown;
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

function slotHasReviewedAnswer(
  slot: QuizAnswerKeyReviewSlotRow,
  reviewedAnswers: Map<number, string>
): boolean {
  if (!slot.slot_index) return false;
  const reviewedAnswer = reviewedAnswers.get(slot.slot_index);
  if (!reviewedAnswer) return false;

  const reviewedHash = hashAnswerKey(reviewedAnswer);
  return (slot.quiz_question_variants ?? []).some(
    (variant) =>
      variant.active !== false && variant.answer_key_hash === reviewedHash
  );
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

  const { data, error } = await supabase
    .from('quiz_events')
    .select(
      'settings, quiz_question_slots(slot_index, quiz_question_variants(active, answer_key_hash))'
    )
    .eq('id', eventId)
    .eq('merchant_id', merchantId)
    .eq('status', 'draft')
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const event = data as QuizAnswerKeyReviewEventRow;
  const slots = (event.quiz_question_slots ?? [])
    .filter((slot) => typeof slot.slot_index === 'number')
    .sort((left, right) => (left.slot_index ?? 0) - (right.slot_index ?? 0));

  if (slots.length === 0 || reviewedAnswers.size !== slots.length) {
    return false;
  }

  if (!slots.every((slot) => slotHasReviewedAnswer(slot, reviewedAnswers))) {
    return false;
  }

  const settings = isSettingsRecord(event.settings) ? event.settings : {};
  const reviewedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('quiz_events')
    .update({
      settings: {
        ...settings,
        answer_key_reviewed: true,
        answer_key_reviewed_at: reviewedAt,
        answer_key_reviewed_count: slots.length,
      },
    })
    .eq('id', eventId)
    .eq('merchant_id', merchantId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  return !updateError && Boolean(updated);
}
