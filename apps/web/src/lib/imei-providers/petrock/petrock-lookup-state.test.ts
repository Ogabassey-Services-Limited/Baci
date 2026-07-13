import { describe, expect, it, vi } from 'vitest';
import {
  claimPetrockLookupPoll,
  finalizePetrockLookup,
  markPetrockSubmissionUnknown,
  recordPetrockSubmission,
  reschedulePetrockLookupPoll,
} from './petrock-lookup-state';

describe('Petrock lookup state transitions', () => {
  it('records the accepted order through the conditional RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await expect(
      recordPetrockSubmission({
        leaseToken: 'lease-1',
        lookupId: 'lookup-1',
        nextPollAt: '2026-07-10T12:00:02.000Z',
        orderId: 'order-1',
        providerStatus: 'new',
        supabaseAdmin: { rpc } as never,
      })
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('record_petrock_imei_submission', {
      p_lookup_id: 'lookup-1',
      p_lease_token: 'lease-1',
      p_next_poll_at: '2026-07-10T12:00:02.000Z',
      p_order_id: 'order-1',
      p_provider_status: 'new',
    });
  });

  it('marks ambiguous submission without refunding', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await markPetrockSubmissionUnknown({
      leaseToken: 'lease-1',
      lookupId: 'lookup-1',
      providerOrderId: 'order-1',
      providerStatus: 'submit_timeout',
      supabaseAdmin: { rpc } as never,
    });

    expect(rpc).toHaveBeenCalledWith(
      'mark_petrock_imei_submission_unknown',
      expect.objectContaining({
        p_lease_token: 'lease-1',
        p_lookup_id: 'lookup-1',
        p_order_id: 'order-1',
      })
    );
  });

  it('finalizes and refunds in one database transaction', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await finalizePetrockLookup({
      body: { code: 'PETROCK_REJECTED', error: 'Rejected', success: false },
      leaseToken: 'lease-1',
      lookupId: 'lookup-1',
      providerStatus: 'reject',
      status: 404,
      supabaseAdmin: { rpc } as never,
      terminalStatus: 'refunded_not_found',
    });

    expect(rpc).toHaveBeenCalledWith(
      'finalize_petrock_imei_lookup',
      expect.objectContaining({
        p_cached_status: 404,
        p_lease_token: 'lease-1',
        p_lookup_id: 'lookup-1',
        p_terminal_status: 'refunded_not_found',
      })
    );
  });

  it('passes a null lease token for an unclaimed initial submission', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await recordPetrockSubmission({
      lookupId: 'lookup-1',
      nextPollAt: '2026-07-10T12:00:02.000Z',
      orderId: 'order-1',
      providerStatus: 'new',
      supabaseAdmin: { rpc } as never,
    });

    expect(rpc).toHaveBeenCalledWith(
      'record_petrock_imei_submission',
      expect.objectContaining({ p_lease_token: null })
    );
  });

  it('claims and reschedules a customer poll with the same lease token', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'lookup-1',
            identifier_ciphertext: 'ciphertext',
            lease_token: 'lease-1',
            provider_order_id: 'order-1',
            status: 'pending_provider',
            tier: 'blacklist',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const supabaseAdmin = { rpc } as never;

    await expect(
      claimPetrockLookupPoll({
        customerId: 'customer-1',
        leaseToken: 'lease-1',
        lookupId: 'lookup-1',
        merchantId: 'merchant-1',
        supabaseAdmin,
      })
    ).resolves.toMatchObject({ provider_order_id: 'order-1' });
    await expect(
      reschedulePetrockLookupPoll({
        leaseToken: 'lease-1',
        lookupId: 'lookup-1',
        nextPollAt: '2026-07-10T12:00:05.000Z',
        providerStatus: 'in-process',
        supabaseAdmin,
      })
    ).resolves.toBe(true);
  });
});
