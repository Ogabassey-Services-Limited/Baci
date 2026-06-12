import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publishScheduledPostsIfDue } from './publish-scheduled-posts-if-due.mjs';

const requiredEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const noop = () => undefined;
const noopLogger = {
  debug: noop,
  error: noop,
  info: noop,
  log: noop,
  trace: noop,
  warn: noop,
};

function createClientMock({ count = 0, error = null } = {}) {
  const calls = [];
  const createSupabaseClient = (url, key, options) => {
    calls.push({ key, options, url });
    return {
      from(table) {
        calls.push({ table });
        return {
          select(columns, selectOptions) {
            calls.push({ columns, selectOptions });
            return {
              eq(column, value) {
                calls.push({ column, operation: 'eq', value });
                return {
                  lte(lteColumn, lteValue) {
                    calls.push({
                      column: lteColumn,
                      operation: 'lte',
                      value: lteValue,
                    });
                    return Promise.resolve({ count, error });
                  },
                };
              },
            };
          },
        };
      },
    };
  };

  return { calls, createSupabaseClient };
}

describe('publishScheduledPostsIfDue', () => {
  it('skips the web cron when no scheduled posts are due', async () => {
    const mock = createClientMock({ count: 0 });
    const runWebCronCalls = [];
    const messages = [];

    const result = await publishScheduledPostsIfDue({
      createSupabaseClient: mock.createSupabaseClient,
      env: requiredEnv,
      logger: { ...noopLogger, log: (message) => messages.push(message) },
      now: new Date('2026-06-12T12:00:00.000Z'),
      runWebCronFn: (args) => {
        runWebCronCalls.push(args);
        return Promise.resolve({ status: 200, body: 'ok' });
      },
    });

    assert.deepEqual(result, { dueCount: 0, invoked: false });
    assert.equal(runWebCronCalls.length, 0);
    assert.deepEqual(mock.calls, [
      {
        key: 'service-key',
        options: { auth: { persistSession: false } },
        url: 'https://project.supabase.co',
      },
      { table: 'blog_posts' },
      { columns: 'id', selectOptions: { count: 'exact', head: true } },
      { column: 'status', operation: 'eq', value: 'scheduled' },
      {
        column: 'published_at',
        operation: 'lte',
        value: '2026-06-12T12:00:00.000Z',
      },
    ]);
    assert.match(messages[0], /skipped web cron/);
  });

  it('invokes the web cron when scheduled posts are due', async () => {
    const mock = createClientMock({ count: 2 });
    const runWebCronCalls = [];
    const env = {
      ...requiredEnv,
      BACI_WEB_BASE_URL: 'https://ogabassey.com',
      CRON_SECRET: 'secret',
    };

    const result = await publishScheduledPostsIfDue({
      createSupabaseClient: mock.createSupabaseClient,
      env,
      logger: noopLogger,
      now: new Date('2026-06-12T12:00:00.000Z'),
      runWebCronFn: (args) => {
        runWebCronCalls.push(args);
        return Promise.resolve({ status: 200, body: 'published' });
      },
    });

    assert.deepEqual(result, {
      dueCount: 2,
      invoked: true,
      result: { status: 200, body: 'published' },
    });
    assert.equal(runWebCronCalls.length, 1);
    assert.equal(runWebCronCalls[0].path, '/api/cron/publish-scheduled-posts');
    assert.equal(runWebCronCalls[0].env, env);
  });

  it('fails closed when Supabase worker credentials are missing', async () => {
    const mock = createClientMock();
    const runWebCronCalls = [];

    await assert.rejects(
      publishScheduledPostsIfDue({
        createSupabaseClient: mock.createSupabaseClient,
        env: {},
        logger: noopLogger,
        runWebCronFn: (args) => {
          runWebCronCalls.push(args);
          return Promise.resolve({ status: 200, body: 'ok' });
        },
      }),
      /NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/
    );
    assert.equal(mock.calls.length, 0);
    assert.equal(runWebCronCalls.length, 0);
  });

  it('reports preflight query failures without invoking the web cron', async () => {
    const mock = createClientMock({
      error: { message: 'database unavailable' },
    });
    const runWebCronCalls = [];

    await assert.rejects(
      publishScheduledPostsIfDue({
        createSupabaseClient: mock.createSupabaseClient,
        env: requiredEnv,
        logger: noopLogger,
        runWebCronFn: (args) => {
          runWebCronCalls.push(args);
          return Promise.resolve({ status: 200, body: 'ok' });
        },
      }),
      /database unavailable/
    );
    assert.equal(runWebCronCalls.length, 0);
  });
});
