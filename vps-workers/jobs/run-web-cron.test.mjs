import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWebCronUrl, runWebCron } from './run-web-cron.mjs';

const noop = () => undefined;
const noopLogger = {
  debug: noop,
  error: noop,
  info: noop,
  log: noop,
  trace: noop,
  warn: noop,
};

describe('web cron worker', () => {
  it('builds normalized URLs for allowlisted cron paths', () => {
    assert.equal(
      buildWebCronUrl({
        baseUrl: 'https://ogabassey.com',
        path: '/api/inventory/push-alerts',
      }),
      'https://ogabassey.com/api/inventory/push-alerts'
    );
  });

  it('rejects unsupported paths', () => {
    assert.throws(
      () =>
        buildWebCronUrl({
          baseUrl: 'https://ogabassey.com',
          path: '/api/admin/users',
        }),
      /Unsupported web cron path/
    );
  });

  it('requires a safe base URL', () => {
    assert.throws(
      () =>
        buildWebCronUrl({
          baseUrl: 'ftp://ogabassey.com',
          path: '/api/ai-jobs/worker',
        }),
      /must use https/
    );
    assert.throws(
      () =>
        buildWebCronUrl({
          baseUrl: 'https://user:pass@ogabassey.com',
          path: '/api/ai-jobs/worker',
        }),
      /must not contain credentials/
    );
  });

  it('sends CRON_SECRET authorization to the web endpoint', async () => {
    const calls = [];
    const result = await runWebCron({
      path: '/api/ai-jobs/worker',
      env: {
        BACI_WEB_BASE_URL: 'https://ogabassey.com',
        CRON_SECRET: 'secret',
      },
      fetchFn: (url, init) => {
        calls.push({ url, init });
        return new Response('ok', { status: 200 });
      },
      logger: noopLogger,
    });

    assert.deepEqual(result, { status: 200, body: 'ok' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://ogabassey.com/api/ai-jobs/worker');
    const { signal, ...initWithoutSignal } = calls[0].init;
    assert.deepEqual(initWithoutSignal, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer secret',
        'User-Agent': 'baci-vps-web-cron/1.0',
      },
    });
    assert.equal(signal instanceof AbortSignal, true);
  });

  it('surfaces non-2xx responses with a bounded body preview', async () => {
    await assert.rejects(
      () =>
        runWebCron({
          path: '/api/cron/publish-scheduled-posts',
          env: {
            BACI_WEB_BASE_URL: 'https://ogabassey.com',
            CRON_SECRET: 'secret',
          },
          fetchFn: () => new Response('unauthorized', { status: 401 }),
          logger: noopLogger,
        }),
      /HTTP 401: unauthorized/
    );
  });

  it('truncates large non-2xx response previews', async () => {
    await assert.rejects(
      () =>
        runWebCron({
          path: '/api/cron/publish-scheduled-posts',
          env: {
            BACI_WEB_BASE_URL: 'https://ogabassey.com',
            CRON_SECRET: 'secret',
          },
          fetchFn: () => new Response('x'.repeat(10_000), { status: 500 }),
          logger: noopLogger,
        }),
      (error) => {
        assert.equal(error instanceof Error, true);
        assert.match(error.message, /HTTP 500:/);
        assert.match(error.message, /\[truncated\]/);
        assert.equal(error.message.length < 700, true);
        return true;
      }
    );
  });

  it('wraps response body read failures', async () => {
    await assert.rejects(
      () =>
        runWebCron({
          path: '/api/inventory/push-alerts',
          env: {
            BACI_WEB_BASE_URL: 'https://ogabassey.com',
            CRON_SECRET: 'secret',
          },
          fetchFn: () => ({
            ok: true,
            status: 200,
            text() {
              throw new Error('body read failed');
            },
          }),
          logger: noopLogger,
        }),
      /request failed: body read failed/
    );
  });

  it('times out hanging web requests', async () => {
    await assert.rejects(
      () =>
        runWebCron({
          path: '/api/ai-jobs/worker',
          env: {
            BACI_WEB_BASE_URL: 'https://ogabassey.com',
            CRON_SECRET: 'secret',
            BACI_WEB_CRON_TIMEOUT_MS: '1',
          },
          fetchFn: async (_url, init) => {
            await new Promise((_resolve, reject) => {
              init.signal.addEventListener('abort', () => {
                reject(new DOMException('timeout', 'TimeoutError'));
              });
            });
          },
          logger: noopLogger,
        }),
      /timed out after 1ms/
    );
  });

  it('requires CRON_SECRET', async () => {
    await assert.rejects(
      () =>
        runWebCron({
          path: '/api/inventory/push-alerts',
          env: { BACI_WEB_BASE_URL: 'https://ogabassey.com' },
          fetchFn: () => new Response('ok', { status: 200 }),
          logger: noopLogger,
        }),
      /CRON_SECRET is required/
    );
  });
});
