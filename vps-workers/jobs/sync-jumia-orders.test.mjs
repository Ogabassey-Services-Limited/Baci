import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runSyncJumiaOrders } from './sync-jumia-orders.mjs';

function createLogger() {
  const errors = [];
  const logs = [];
  return {
    errors,
    logs,
    error(...args) {
      errors.push(args);
    },
    log(...args) {
      logs.push(args);
    },
  };
}

const successfulResult = {
  integrations: 2,
  synced: 4,
  canonicalCreated: 1,
  canonicalUpdated: 3,
  notified: 1,
  errors: [],
};

describe('sync-jumia-orders worker', () => {
  it('returns a successful sync summary', async () => {
    const logger = createLogger();

    const result = await runSyncJumiaOrders({
      supabase: {},
      expo: {},
      logger,
      syncOrders: async () => successfulResult,
    });

    assert.deepEqual(result, successfulResult);
    assert.equal(logger.logs.length, 1);
    assert.equal(logger.errors.length, 0);
  });

  it('throws when the sync result shape is invalid', async () => {
    await assert.rejects(
      runSyncJumiaOrders({
        supabase: {},
        expo: {},
        logger: createLogger(),
        syncOrders: async () => ({ integrations: 1 }),
      }),
      /Invalid sync result/
    );
  });

  it('logs and throws when an integration sync fails', async () => {
    const logger = createLogger();

    await assert.rejects(
      runSyncJumiaOrders({
        supabase: {},
        expo: {},
        logger,
        syncOrders: async () => ({
          ...successfulResult,
          errors: ['merchant-1: token expired'],
        }),
      }),
      /completed with 1 error/
    );

    assert.deepEqual(logger.errors, [
      ['[sync-jumia-orders] error:', 'merchant-1: token expired'],
    ]);
  });

  it('logs each integration error before failing the worker run', async () => {
    const logger = createLogger();

    await assert.rejects(
      runSyncJumiaOrders({
        supabase: {},
        expo: {},
        logger,
        syncOrders: async () => ({
          ...successfulResult,
          errors: ['merchant-1: token expired', 'merchant-2: API timeout'],
        }),
      }),
      /completed with 2 error/
    );

    assert.deepEqual(logger.errors, [
      ['[sync-jumia-orders] error:', 'merchant-1: token expired'],
      ['[sync-jumia-orders] error:', 'merchant-2: API timeout'],
    ]);
  });

  it('fails clearly when required clients are missing', async () => {
    await assert.rejects(
      runSyncJumiaOrders({
        supabase: null,
        expo: {},
        logger: createLogger(),
        syncOrders: async () => successfulResult,
      }),
      /requires supabase and expo clients/
    );
    await assert.rejects(
      runSyncJumiaOrders({
        supabase: {},
        expo: null,
        logger: createLogger(),
        syncOrders: async () => successfulResult,
      }),
      /requires supabase and expo clients/
    );
  });
});
