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
      env: {
        BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com',
        ZEPTOMAIL_TOKEN: 'token',
      },
      fetchFn: () => {
        throw new Error('network unavailable');
      },
      logger: { error: () => undefined },
      state: {
        acknowledgeNotification: (id) => acknowledgements.push(id),
        notifications: () => [
          {
            id: 'notice-2',
            report: { html: '<p>x</p>', subject: 'x', text: 'x' },
          },
        ],
        scheduleNotificationRetry: () => true,
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(acknowledgements, []);
    assert.deepEqual(result.actions, [
      { detail: 'network unavailable', type: 'email_retry_failed' },
    ]);
  });

  it('retains a notification when delivery is skipped', async () => {
    const acknowledgements = [];
    const result = await retryRemediationNotifications({
      env: {},
      fetchFn: fetch,
      logger: { error: () => undefined },
      state: {
        acknowledgeNotification: (id) => acknowledgements.push(id),
        notifications: () => [
          {
            id: 'notice-3',
            report: { html: '<p>x</p>', subject: 'x', text: 'x' },
          },
        ],
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(acknowledgements, []);
    assert.deepEqual(result.actions, [
      { detail: 'notice-3', type: 'email_skipped' },
    ]);
  });

  it('bounds an outage retry batch and defers each failed notification', async () => {
    const calls = [];
    const scheduled = [];
    const secret = ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz'].join('_');
    const notifications = ['notice-1', 'notice-2', 'notice-3'].map((id) => ({
      attempts: 2,
      id,
      report: { html: '<p>x</p>', subject: 'x', text: 'x' },
    }));
    const result = await retryRemediationNotifications({
      env: {
        BACI_REMEDIATION_NOTIFICATION_RETRY_BATCH_SIZE: '2',
        BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com',
        ZEPTOMAIL_TOKEN: 'token',
      },
      fetchFn: () => {
        calls.push('send');
        throw new Error(`Authorization: Bearer ${secret}`);
      },
      logger: { error: () => undefined },
      now: () => Date.parse('2026-08-09T10:00:00.000Z'),
      state: {
        acknowledgeNotification: () => undefined,
        notifications: (options) =>
          options ? notifications.slice(0, options.limit) : notifications,
        scheduleNotificationRetry: (id, nextAttemptAt) =>
          scheduled.push({ id, nextAttemptAt }),
      },
      workerName: 'test-remediator',
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(scheduled, [
      { id: 'notice-1', nextAttemptAt: '2026-08-09T10:04:00.000Z' },
      { id: 'notice-2', nextAttemptAt: '2026-08-09T10:04:00.000Z' },
    ]);
    assert.equal(result.actions.length, 2);
    assert.equal(
      result.actions.every((action) => action.type === 'email_retry_failed'),
      true
    );
    assert.equal(
      result.actions.some((action) => action.detail.includes(secret)),
      false
    );
  });
});
