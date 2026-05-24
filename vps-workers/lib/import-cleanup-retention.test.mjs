import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanupStaleImportJobs } from './import-cleanup-retention.mjs';

const noop = () => undefined;
const noopLogger = {
  error: noop,
  info: noop,
  warn: noop,
};

function createSupabaseMock() {
  const calls = [];
  const staleJobs = [
    {
      id: 'job-preview',
      merchant_id: 'merchant-1',
      client_upload_id: 'upload-1',
      storage_path: 'merchant-1/orders/upload-1.csv',
      status: 'preview_ready',
    },
    {
      id: 'job-completed',
      merchant_id: 'merchant-2',
      client_upload_id: 'upload-2',
      storage_path: 'merchant-2/orders/upload-2.csv',
      status: 'completed',
    },
  ];

  function builder(table) {
    const state = { eqCount: 0, operation: 'select' };
    const chain = {
      delete(options) {
        calls.push(['delete', table, options]);
        state.operation = 'delete';
        return chain;
      },
      eq(column, value) {
        calls.push(['eq', table, column, value]);
        state.eqCount += 1;
        if (
          table === 'pending_import_uploads' &&
          state.operation === 'delete' &&
          state.eqCount === 2
        ) {
          return Promise.resolve({ count: 1, error: null });
        }
        return chain;
      },
      gt(column, value) {
        calls.push(['gt', table, column, value]);
        return chain;
      },
      in(column, values) {
        calls.push(['in', table, column, values]);
        if (state.operation === 'update') {
          return Promise.resolve({ count: values.length, error: null });
        }
        if (state.operation === 'delete') {
          return Promise.resolve({ count: values.length, error: null });
        }
        return chain;
      },
      limit(limit) {
        calls.push(['limit', table, limit]);
        return Promise.resolve({ data: staleJobs, error: null });
      },
      lt(column, value) {
        calls.push(['lt', table, column, value]);
        return chain;
      },
      order(column, options) {
        calls.push(['order', table, column, options]);
        return chain;
      },
      select(columns) {
        calls.push(['select', table, columns]);
        return chain;
      },
      update(payload, options) {
        calls.push(['update', table, payload, options]);
        state.operation = 'update';
        return chain;
      },
    };
    return chain;
  }

  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return builder(table);
    },
    storage: {
      from(bucket) {
        calls.push(['storage.from', bucket]);
        return {
          remove(paths) {
            calls.push(['storage.remove', bucket, paths]);
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    },
  };
}

describe('cleanupStaleImportJobs', () => {
  it('expires stale previews and removes import rows, pending uploads, and CSV files', async () => {
    const supabase = createSupabaseMock();

    const result = await cleanupStaleImportJobs({
      logger: noopLogger,
      now: new Date('2026-05-24T12:00:00.000Z'),
      retentionDays: 30,
      supabase,
    });

    assert.equal(result.scannedJobs, 2);
    assert.equal(result.expiredPreviewJobs, 1);
    assert.equal(result.deletedImportRows, 2);
    assert.equal(result.deletedPendingUploads, 2);
    assert.equal(result.removedStorageObjects, 2);
    assert.deepEqual(
      supabase.calls.find((call) => call[0] === 'storage.remove'),
      [
        'storage.remove',
        'migration-imports',
        ['merchant-1/orders/upload-1.csv', 'merchant-2/orders/upload-2.csv'],
      ]
    );
    assert.ok(
      supabase.calls.some(
        (call) =>
          call[0] === 'update' &&
          call[1] === 'import_jobs' &&
          call[2].status === 'failed'
      )
    );
  });
});
