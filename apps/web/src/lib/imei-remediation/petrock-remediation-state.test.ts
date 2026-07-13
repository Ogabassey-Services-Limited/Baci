import { describe, expect, it, vi } from 'vitest';
import {
  createPetrockEligibilityAssessment,
  createPetrockEligibilityState,
} from './petrock-remediation-state';

describe('Petrock remediation state', () => {
  it('persists a private eligibility assessment before house checks', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        eligibility_checks_completed: [],
        eligibility_evidence: { carrier: 'Unknown' },
        id: 'order-1',
        status: 'eligibility_pending',
      },
      error: null,
    });
    const builder = {
      insert: vi.fn(() => builder),
      select: vi.fn(() => builder),
      maybeSingle,
    };
    const supabaseAdmin = { from: vi.fn(() => builder) };

    await expect(
      createPetrockEligibilityAssessment({
        customerId: 'customer-1',
        evidence: { carrier: 'Unknown' },
        identifierCiphertext: 'ciphertext',
        identifierHash: 'a'.repeat(64),
        merchantId: 'merchant-1',
        sourceLookupId: 'lookup-1',
        supabaseAdmin: supabaseAdmin as never,
      })
    ).resolves.toMatchObject({ id: 'order-1' });
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eligibility_evidence: { carrier: 'Unknown' },
        identifier_ciphertext: 'ciphertext',
        status: 'eligibility_pending',
      })
    );
  });

  it('maps engine transitions to service-role-only RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const state = createPetrockEligibilityState({ rpc } as never);

    await state.begin({
      check: 'carrier_detection',
      feedbackTokenHash: 'hash',
      orderId: 'order-1',
      referenceId: 'reference-1',
    });

    expect(rpc).toHaveBeenCalledWith('begin_petrock_eligibility_check', {
      p_check_kind: 'carrier_detection',
      p_feedback_token_hash: 'hash',
      p_order_id: 'order-1',
      p_reference_id: 'reference-1',
    });
  });

  it('throws a real error when an insert succeeds without returning a row', async () => {
    const builder = {
      insert: vi.fn(() => builder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(() => builder),
    };

    await expect(
      createPetrockEligibilityAssessment({
        customerId: 'customer-1',
        evidence: { carrier: 'Unknown' },
        identifierCiphertext: 'ciphertext',
        identifierHash: 'a'.repeat(64),
        merchantId: 'merchant-1',
        sourceLookupId: 'lookup-1',
        supabaseAdmin: { from: vi.fn(() => builder) } as never,
      })
    ).rejects.toThrow('Eligibility assessment insert returned no row');
  });
});
