import { describe, expect, it, vi } from 'vitest';
import { hashAnswerKey } from './quiz-answer-key';
import {
  hasPersistedAnswerKeyReview,
  recordMerchantQuizAnswerKeyReview,
} from './quiz-answer-key-review';

function mockRpcSupabase(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { rpc, supabase: { rpc } };
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
  it('sends reviewed answer hashes (keyed by slot_index) to the definer RPC and returns its verdict', async () => {
    const { rpc, supabase } = mockRpcSupabase({ data: true, error: null });

    await expect(
      recordMerchantQuizAnswerKeyReview(supabase as never, 'event-1', 'm-1', [
        { correctOptionId: 'a', position: 1 },
        { correctOptionId: 'b', position: 2 },
      ])
    ).resolves.toBe(true);
    // Only hashes are sent — never the answer key itself. The user client can't
    // read answer_key_hash, so the RPC compares with definer rights.
    expect(rpc).toHaveBeenCalledWith('record_merchant_quiz_answer_key_review', {
      p_event_id: 'event-1',
      p_merchant_id: 'm-1',
      p_reviewed: { '1': hashAnswerKey('a'), '2': hashAnswerKey('b') },
    });
  });

  it('returns false when the RPC rejects the review', async () => {
    const { supabase } = mockRpcSupabase({ data: false, error: null });

    await expect(
      recordMerchantQuizAnswerKeyReview(supabase as never, 'event-1', 'm-1', [
        { correctOptionId: 'a', position: 1 },
      ])
    ).resolves.toBe(false);
  });

  it('returns false when the RPC errors', async () => {
    const { supabase } = mockRpcSupabase({
      data: null,
      error: { message: 'boom' },
    });

    await expect(
      recordMerchantQuizAnswerKeyReview(supabase as never, 'event-1', 'm-1', [
        { correctOptionId: 'a', position: 1 },
      ])
    ).resolves.toBe(false);
  });

  it('rejects duplicate reviewed positions without calling the RPC', async () => {
    const { rpc, supabase } = mockRpcSupabase({ data: true, error: null });

    await expect(
      recordMerchantQuizAnswerKeyReview(supabase as never, 'event-1', 'm-1', [
        { correctOptionId: 'a', position: 1 },
        { correctOptionId: 'b', position: 1 },
      ])
    ).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
