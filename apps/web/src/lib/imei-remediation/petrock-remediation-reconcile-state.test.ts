import { describe, expect, it, vi } from 'vitest';
import { createPetrockRemediationReconcileState } from './petrock-remediation-reconcile-state';

describe('createPetrockRemediationReconcileState', () => {
  it('conditions reschedules on the row lease token through the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const state = createPetrockRemediationReconcileState({ rpc } as never);

    await state.reschedule({
      leaseToken: 'lease-1',
      nextPollAt: '2026-07-11T00:00:00.000Z',
      orderId: 'order-1',
      providerStatus: 'in-process',
    });

    expect(rpc).toHaveBeenCalledWith('reschedule_petrock_remediation_order', {
      p_lease_token: 'lease-1',
      p_next_poll_at: '2026-07-11T00:00:00.000Z',
      p_order_id: 'order-1',
      p_provider_status: 'in-process',
    });
  });
});
