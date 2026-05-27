import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAiStorefrontTriggerHandler,
  spawnAiStorefrontWorker,
} from './ai-storefront-trigger-server.mjs';

const noopLogger = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

function createRequest({ headers = {}, method = 'POST', body = {} } = {}) {
  return new Request('http://127.0.0.1:3917/ai-storefront/trigger', {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

describe('ai storefront trigger server', () => {
  it('rejects requests without the configured bearer secret', async () => {
    const calls = [];
    const handler = createAiStorefrontTriggerHandler({
      env: { AI_STOREFRONT_TRIGGER_SECRET: 'secret' },
      logger: noopLogger,
      spawnWorker: (payload) => {
        calls.push(payload);
      },
    });

    const response = await handler(
      createRequest({ headers: { authorization: 'Bearer wrong' } })
    );

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });

  it('accepts a signed trigger and starts the storefront worker once', async () => {
    const calls = [];
    const handler = createAiStorefrontTriggerHandler({
      env: { AI_STOREFRONT_TRIGGER_SECRET: 'secret' },
      logger: noopLogger,
      spawnWorker: (payload) => {
        calls.push(payload);
      },
    });

    const response = await handler(
      createRequest({
        headers: { authorization: 'Bearer secret' },
        body: { jobId: 'job-1', merchantId: 'merchant-1', source: 'api' },
      })
    );

    assert.equal(response.status, 202);
    assert.deepEqual(calls, [
      { jobId: 'job-1', merchantId: 'merchant-1', source: 'api' },
    ]);
    assert.deepEqual(await response.json(), {
      accepted: true,
      status: 'started',
    });
  });

  it('rejects payloads over the configured body limit before spawning', async () => {
    const calls = [];
    const handler = createAiStorefrontTriggerHandler({
      env: { AI_STOREFRONT_TRIGGER_SECRET: 'secret' },
      logger: noopLogger,
      spawnWorker: (payload) => {
        calls.push(payload);
      },
    });

    const response = await handler(
      createRequest({
        headers: {
          authorization: 'Bearer secret',
          'content-length': '4097',
        },
        body: { source: 'api' },
      })
    );

    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });

  it('passes trigger metadata to the spawned storefront worker environment', () => {
    let spawnCall;

    const result = spawnAiStorefrontWorker({
      createWriteStreamFn: () => ({}),
      env: { EXISTING_ENV: 'present' },
      logger: noopLogger,
      payload: { jobId: 'job-1', merchantId: 'merchant-1', source: 'api' },
      spawnFn: (command, args, options) => {
        spawnCall = { args, command, options };
        return { pid: 1234, unref: () => undefined };
      },
    });

    assert.equal(result.pid, 1234);
    assert.equal(spawnCall.command, 'flock');
    assert.equal(spawnCall.options.env.EXISTING_ENV, 'present');
    assert.equal(
      spawnCall.options.env.BACI_WORKER_PROFILE,
      'ai-storefront-jobs'
    );
    assert.equal(spawnCall.options.env.NODE_ENV, 'production');
    assert.equal(spawnCall.options.env.AI_STOREFRONT_TRIGGER_JOB_ID, 'job-1');
    assert.equal(
      spawnCall.options.env.AI_STOREFRONT_TRIGGER_MERCHANT_ID,
      'merchant-1'
    );
    assert.equal(spawnCall.options.env.AI_STOREFRONT_TRIGGER_SOURCE, 'api');
    assert.equal(
      spawnCall.args.at(-1).includes('export NODE_ENV=production'),
      false
    );
  });
});
