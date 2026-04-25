import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runInventoryPushAlerts } from './inventory-push-alerts.mjs';
import {
  baseAlert,
  createInventorySupabase,
  createLogger,
} from './inventory-push-alerts.test-helpers.mjs';

describe('inventory-push-alerts worker failure paths', () => {
  it('records thrown notification exceptions as failed attempts', async () => {
    const supabase = createInventorySupabase({ alerts: [baseAlert] });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      logger: createLogger(),
      notify: () => {
        throw new Error('Expo crashed');
      },
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

  it('tracks update failures without counting the alert as sent', async () => {
    const supabase = createInventorySupabase({
      alerts: [baseAlert],
      updateError: { message: 'update failed' },
    });

    const summary = await runInventoryPushAlerts({
      supabase,
      expo: {},
      logger: createLogger(),
      notify: () => Promise.resolve({ sent: 1, failed: 0, errors: [] }),
    });

    assert.deepEqual(summary, {
      total: 1,
      sent: 0,
      skippedNoTokens: 0,
      failed: 0,
      partialFailures: 0,
      updateFailures: 1,
    });
  });

  it('throws when alerts cannot be fetched', async () => {
    const supabase = createInventorySupabase({
      alerts: null,
      fetchError: { message: 'database unavailable' },
    });

    await assert.rejects(
      runInventoryPushAlerts({
        supabase,
        expo: {},
        logger: createLogger(),
      }),
      /Failed to fetch alerts: database unavailable/
    );
    assert.deepEqual(supabase.updates, []);
  });
});
