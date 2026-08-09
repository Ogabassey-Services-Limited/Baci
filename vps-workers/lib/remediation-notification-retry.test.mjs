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
      fetchFn: async () => new Response('{}', { status: 200 }),
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

  it('retains a notification when retry delivery fails', async () => {
    const acknowledgements = [];
    const result = await retryRemediationNotifications({
      env: { BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com', ZEPTOMAIL_TOKEN: 'token' },
      fetchFn: async () => { throw new Error('network unavailable'); },
      logger: { error: () => undefined },
      state: {
        acknowledgeNotification: (id) => acknowledgements.push(id),
        notifications: () => [{ id: 'notice-2', report: { html: '<p>x</p>', subject: 'x', text: 'x' } }],
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(acknowledgements, []);
    assert.deepEqual(result.actions, [{ detail: 'network unavailable', type: 'email_retry_failed' }]);
  });

  it('retains a notification when delivery is skipped', async () => {
    const acknowledgements = [];
    const result = await retryRemediationNotifications({
      env: {},
      fetchFn: fetch,
      logger: { error: () => undefined },
      state: {
        acknowledgeNotification: (id) => acknowledgements.push(id),
        notifications: () => [{ id: 'notice-3', report: { html: '<p>x</p>', subject: 'x', text: 'x' } }],
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(acknowledgements, []);
    assert.deepEqual(result.actions, [{ detail: 'notice-3', type: 'email_skipped' }]);
  });
});
