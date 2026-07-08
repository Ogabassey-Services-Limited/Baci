import { describe, expect, it, vi } from 'vitest';
import { hashAnswerKey } from './quiz-answer-key';
import {
  hasPersistedAnswerKeyReview,
  recordMerchantQuizAnswerKeyReview,
} from './quiz-answer-key-review';

function mockSupabase({
  lookupResult,
  updateResult = { data: { id: 'event-1' }, error: null },
}: {
  lookupResult: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
}) {
  const lookupBuilder = {
    eq: vi.fn(() => lookupBuilder),
    maybeSingle: vi.fn().mockResolvedValue(lookupResult),
    select: vi.fn(() => lookupBuilder),
  };
  const updateBuilder = {
    eq: vi.fn(() => updateBuilder),
    maybeSingle: vi.fn().mockResolvedValue(updateResult),
    select: vi.fn(() => updateBuilder),
    update: vi.fn(() => updateBuilder),
  };
  const supabase = {
    from: vi
      .fn()
      .mockReturnValueOnce(lookupBuilder)
      .mockReturnValueOnce(updateBuilder),
  };
  return { lookupBuilder, supabase, updateBuilder };
}

describe('hasPersistedAnswerKeyReview', () => {
  it('requires both the review flag and timestamp marker', () => {
    expect(
      hasPersistedAnswerKeyReview({
        answer_key_reviewed: true,
        answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
      })
    ).toBe(true);
    expect(hasPersistedAnswerKeyReview({ answer_key_reviewed: true })).toBe(
      false
    );
    expect(
      hasPersistedAnswerKeyReview({
        answer_key_reviewed: true,
        answer_key_reviewed_at: ' ',
      })
    ).toBe(false);
  });
});

describe('recordMerchantQuizAnswerKeyReview', () => {
  it('persists the reviewed marker when every submitted answer matches a slot', async () => {
    const { supabase, updateBuilder } = mockSupabase({
      lookupResult: {
        data: {
          quiz_question_slots: [
            {
              quiz_question_variants: [
                { active: true, answer_key_hash: hashAnswerKey('a') },
              ],
              slot_index: 1,
            },
          ],
          settings: { existing: true },
        },
        error: null,
      },
    });

    await expect(
      recordMerchantQuizAnswerKeyReview(supabase as never, 'event-1', 'm-1', [
        { correctOptionId: 'a', position: 1 },
      ])
    ).resolves.toBe(true);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      settings: expect.objectContaining({
        answer_key_reviewed: true,
        answer_key_reviewed_count: 1,
        existing: true,
      }),
    });
  });

  it('rejects mismatched reviewed answers without updating the event', async () => {
    const { supabase, updateBuilder } = mockSupabase({
      lookupResult: {
        data: {
          quiz_question_slots: [
            {
              quiz_question_variants: [
                { active: true, answer_key_hash: hashAnswerKey('b') },
              ],
              slot_index: 1,
            },
          ],
        },
        error: null,
      },
    });

    await expect(
      recordMerchantQuizAnswerKeyReview(supabase as never, 'event-1', 'm-1', [
        { correctOptionId: 'a', position: 1 },
      ])
    ).resolves.toBe(false);
    expect(updateBuilder.update).not.toHaveBeenCalled();
  });
});
