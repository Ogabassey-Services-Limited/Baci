import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAlertNotification,
  runInventoryPushAlerts,
} from './inventory-push-alerts.mjs';
import {
  baseAlert,
  createInventorySupabase,
  createLogger,
} from './inventory-push-alerts.test-helpers.mjs';

describe('inventory-push-alerts worker', () => {
  it('maps alert notification copy by alert type', () => {
    assert.equal(getAlertNotification('stockout').title, 'Stockout Alert');
    assert.equal(getAlertNotification('reorder_point').type, 'reorder_point');
    assert.equal(getAlertNotification('unknown').type, 'low_stock');
  });

  it('returns an empty summary when there are no pending alerts', async () => {
    const supabase = createInventorySupabase({ alerts: [] });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      logger: createLogger(),
      notify: () => {
        throw new Error('notify should not run');
      },
    });

    assert.deepEqual(summary, {
      total: 0,
      sent: 0,
      skippedNoTokens: 0,
      failed: 0,
      partialFailures: 0,
      updateFailures: 0,
    });
  });

  it('marks alerts processed when the merchant has no active push tokens', async () => {
    const supabase = createInventorySupabase({ alerts: [baseAlert] });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      now: () => '2026-04-25T08:00:00.000Z',
      logger: createLogger(),
      notify: () => Promise.resolve({ sent: 0, failed: 0, errors: [] }),
    });

    assert.deepEqual(summary, {
      total: 1,
      sent: 0,
      skippedNoTokens: 1,
      failed: 0,
      partialFailures: 0,
      updateFailures: 0,
    });
    assert.deepEqual(supabase.updates, [
      {
        notification_sent: true,
        notification_sent_at: '2026-04-25T08:00:00.000Z',
      },
    ]);
  });

  it('records failed push attempts and leaves alerts retryable below the cap', async () => {
    const supabase = createInventorySupabase({ alerts: [baseAlert] });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      logger: createLogger(),
      notify: () =>
        Promise.resolve({ sent: 0, failed: 1, errors: ['Expo failed'] }),
    });

    assert.deepEqual(summary, {
      total: 1,
      sent: 0,
      skippedNoTokens: 0,
      failed: 1,
      partialFailures: 0,
      updateFailures: 0,
    });
    assert.deepEqual(supabase.updates, [{ notification_attempts: 1 }]);
  });

  it('records token fetch errors instead of marking alerts processed', async () => {
    const supabase = createInventorySupabase({ alerts: [baseAlert] });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      logger: createLogger(),
      notify: () =>
        Promise.resolve({
          sent: 0,
          failed: 0,
          errors: ['Push token lookup failed'],
        }),
    });

    assert.deepEqual(summary, {
      total: 1,
      sent: 0,
      skippedNoTokens: 0,
      failed: 1,
      partialFailures: 0,
      updateFailures: 0,
    });
    assert.deepEqual(supabase.updates, [{ notification_attempts: 1 }]);
  });

  it('marks failed alerts processed after the retry cap', async () => {
    const supabase = createInventorySupabase({
      alerts: [{ ...baseAlert, notification_attempts: 2 }],
    });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      now: () => '2026-04-25T10:00:00.000Z',
      logger: createLogger(),
      notify: () =>
        Promise.resolve({ sent: 0, failed: 1, errors: ['Expo failed'] }),
    });

    assert.deepEqual(summary, {
      total: 1,
      sent: 0,
      skippedNoTokens: 0,
      failed: 1,
      partialFailures: 0,
      updateFailures: 0,
    });
    assert.deepEqual(supabase.updates, [
      {
        notification_attempts: 3,
        notification_sent: true,
        notification_sent_at: '2026-04-25T10:00:00.000Z',
      },
    ]);
  });

  it('aggregates mixed batch outcomes', async () => {
    const alerts = [
      baseAlert,
      {
        ...baseAlert,
        id: 'alert-2',
        products: { id: 'product-2', name: 'Charger' },
      },
      {
        ...baseAlert,
        id: 'alert-3',
        products: { id: 'product-3', name: 'Cable' },
      },
    ];
    const supabase = createInventorySupabase({ alerts });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      now: () => '2026-04-25T11:00:00.000Z',
      logger: createLogger(),
      notify: ({ data }) => {
        if (data.product_id === 'product-1') {
          return Promise.resolve({ sent: 1, failed: 0, errors: [] });
        }
        if (data.product_id === 'product-2') {
          return Promise.resolve({ sent: 0, failed: 0, errors: [] });
        }
        return Promise.resolve({ sent: 0, failed: 1, errors: ['Expo failed'] });
      },
    });

    assert.deepEqual(summary, {
      total: 3,
      sent: 1,
      skippedNoTokens: 1,
      failed: 1,
      partialFailures: 0,
      updateFailures: 0,
    });
    assert.deepEqual(supabase.updates, [
      {
        notification_sent: true,
        notification_sent_at: '2026-04-25T11:00:00.000Z',
      },
      {
        notification_sent: true,
        notification_sent_at: '2026-04-25T11:00:00.000Z',
      },
      { notification_attempts: 1 },
    ]);
  });

  it('marks successfully sent alerts as processed', async () => {
    const supabase = createInventorySupabase({ alerts: [baseAlert] });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      now: () => '2026-04-25T09:00:00.000Z',
      logger: createLogger(),
      notify: () => Promise.resolve({ sent: 1, failed: 0, errors: [] }),
    });

    assert.deepEqual(summary, {
      total: 1,
      sent: 1,
      skippedNoTokens: 0,
      failed: 0,
      partialFailures: 0,
      updateFailures: 0,
    });
    assert.deepEqual(supabase.updates, [
      {
        notification_sent: true,
        notification_sent_at: '2026-04-25T09:00:00.000Z',
      },
    ]);
  });

  it('tracks partial push failures while marking the alert processed', async () => {
    const supabase = createInventorySupabase({ alerts: [baseAlert] });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      now: () => '2026-04-25T12:00:00.000Z',
      logger: createLogger(),
      notify: () =>
        Promise.resolve({ sent: 1, failed: 1, errors: ['one token failed'] }),
    });

    assert.deepEqual(summary, {
      total: 1,
      sent: 1,
      skippedNoTokens: 0,
      failed: 0,
      partialFailures: 1,
      updateFailures: 0,
    });
    assert.deepEqual(supabase.updates, [
      {
        notification_sent: true,
        notification_sent_at: '2026-04-25T12:00:00.000Z',
      },
    ]);
  });
});
