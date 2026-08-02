import assert from 'node:assert/strict';
import { it } from 'node:test';
import { runWebCron } from './run-web-cron.mjs';

it('allows the merchant signup health cron endpoint', async () => {
  const calls = [];
  const result = await runWebCron({
    path: '/api/cron/merchant-signup-health',
    env: {
      BACI_WEB_BASE_URL: 'https://ogabassey.com',
      CRON_SECRET: 'secret',
    },
    fetchFn: (url, init) => {
      calls.push({ url, init });
      return new Response('ok', { status: 200 });
    },
    logger: { log: () => undefined },
  });

  assert.deepEqual(result, { status: 200, body: 'ok' });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://ogabassey.com/api/cron/merchant-signup-health'
  );
  assert.equal(calls[0].init.method, 'GET');
});

it('fails the merchant signup health cron on policy drift', async () => {
  const calls = [];

  await assert.rejects(
    runWebCron({
      path: '/api/cron/merchant-signup-health',
      env: {
        BACI_WEB_BASE_URL: 'https://ogabassey.com',
        CRON_SECRET: 'secret',
      },
      fetchFn: (url, init) => {
        calls.push({ url, init });
        return new Response('{"healthy":false}', { status: 503 });
      },
      logger: { log: () => undefined },
    }),
    /HTTP 503/
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://ogabassey.com/api/cron/merchant-signup-health'
  );
  assert.equal(calls[0].init.method, 'GET');
});
