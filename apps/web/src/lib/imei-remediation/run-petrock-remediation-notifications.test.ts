import { describe, expect, it, vi } from 'vitest';

const notify = vi.hoisted(() => vi.fn());
vi.mock('./petrock-remediation-notifications', () => ({
  notifyPetrockRemediationTerminal: notify,
}));

import { runPetrockRemediationNotifications } from './run-petrock-remediation-notifications';

describe('runPetrockRemediationNotifications', () => {
  it('retries terminal orders with an unclaimed email or push channel', async () => {
    const builder = {
      in: vi.fn(() => builder),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'one' }, { id: 'two' }],
        error: null,
      }),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      select: vi.fn(() => builder),
    };
    notify
      .mockResolvedValueOnce({ email: 'sent', push: 'sent' })
      .mockRejectedValueOnce(new Error('temporary'));

    await expect(
      runPetrockRemediationNotifications({
        supabaseAdmin: { from: vi.fn(() => builder) } as never,
      })
    ).resolves.toEqual({ claimed: 2, errored: 1, processed: 1 });
    expect(builder.or).toHaveBeenCalledWith(
      'email_notified_at.is.null,push_notified_at.is.null'
    );
  });
});
