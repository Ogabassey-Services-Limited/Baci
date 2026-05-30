import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanupAgenticRequestRecords } from './cleanup-agentic-request-records.mjs';

const requiredEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

function createClientMock({ error = null } = {}) {
  const calls = [];
  const createClient = (url, key, options) => {
    calls.push({ key, options, url });
    return {
      from(table) {
        calls.push({ table });
        return {
          delete() {
            calls.push({ operation: 'delete' });
            return {
              lt(column, value) {
                calls.push({ column, value });
                return Promise.resolve({ error });
              },
            };
          },
        };
      },
    };
  };

  return { calls, createClient };
}

describe('cleanupAgenticRequestRecords', () => {
  it('deletes only records expired more than one hour before the run', async () => {
    const mock = createClientMock();
    const messages = [];

    const result = await cleanupAgenticRequestRecords({
      createSupabaseClient: mock.createClient,
      env: requiredEnv,
      logger: { log: (message) => messages.push(message) },
      now: new Date('2026-05-24T12:00:00.000Z'),
    });

    assert.deepEqual(result, {
      cutoff: '2026-05-24T11:00:00.000Z',
    });
    assert.deepEqual(mock.calls, [
      {
        key: 'service-key',
        options: { auth: { persistSession: false } },
        url: 'https://project.supabase.co',
      },
      { table: 'agentic_request_records' },
      { operation: 'delete' },
      { column: 'expires_at', value: '2026-05-24T11:00:00.000Z' },
    ]);
    assert.match(messages[0], /expires_at < 2026-05-24T11:00:00.000Z/);
  });

  it('fails closed when worker database credentials are missing', async () => {
    const mock = createClientMock();

    await assert.rejects(
      cleanupAgenticRequestRecords({
        createSupabaseClient: mock.createClient,
        env: {},
      }),
      /NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/
    );
    assert.equal(mock.calls.length, 0);
  });

  it('reports deletion failures to the scheduler', async () => {
    const mock = createClientMock({
      error: { message: 'database unavailable' },
    });

    await assert.rejects(
      cleanupAgenticRequestRecords({
        createSupabaseClient: mock.createClient,
        env: requiredEnv,
        now: new Date('2026-05-24T12:00:00.000Z'),
      }),
      /database unavailable/
    );
  });
});
