import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { retryRemediationNotifications } from './remediation-notification-retry.mjs';

describe('remediation notification retry', () => {
  it('acknowledges a delivered persisted notification', async () => {
    const acknowledgements = [];
    const result = await retryRemediationNotifications({
      env: {
        BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com',
        ZEPTOMAIL_TOKEN: 'token',
      },
      fetchFn: async () => ({ ok: true }),
      logger: { error: () => undefined },
      state: {
        acknowledgeNotification: (id) => acknowledgements.push(id),
        notifications: () => [
          {
            id: 'notice-1',
            report: { html: '<p>x</p>', subject: 'x', text: 'x' },
          },
        ],
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(acknowledgements, ['notice-1']);
    assert.deepEqual(result.actions, [
      { detail: 'notice-1', type: 'email_retried' },
    ]);
  });
});
