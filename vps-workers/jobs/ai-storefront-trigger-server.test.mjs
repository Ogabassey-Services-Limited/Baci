import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { describe, it } from 'node:test';
import {
  createAiStorefrontTriggerHandler,
  spawnAiStorefrontWorker,
  startAiStorefrontTriggerServer,
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

function sendNodeRequest({ body, headers = {}, port }) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        headers: {
          authorization: 'Bearer secret',
          'content-length': Buffer.byteLength(body),
          ...headers,
        },
        host: '127.0.0.1',
        method: 'POST',
        path: '/ai-storefront/trigger',
        port,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            statusCode: response.statusCode,
          });
        });
      }
    );
    request.on('error', reject);
    request.end(body);
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

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: 'payload_too_large' });
    assert.equal(calls.length, 0);
  });

  it('returns 413 for oversized node request bodies', async () => {
    const port = 3927;
    const server = startAiStorefrontTriggerServer({
      env: {
        AI_STOREFRONT_TRIGGER_HOST: '127.0.0.1',
        AI_STOREFRONT_TRIGGER_PORT: String(port),
        AI_STOREFRONT_TRIGGER_SECRET: 'secret',
      },
      logger: noopLogger,
    });

    try {
      await once(server, 'listening');

      const response = await sendNodeRequest({
        body: 'x'.repeat(4097),
        port,
      });

      assert.equal(response.statusCode, 413);
      assert.deepEqual(JSON.parse(response.body), {
        error: 'payload_too_large',
      });
    } finally {
      server.close();
      await once(server, 'close');
    }
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

  it('shares one append stream for worker logs and records stream errors', () => {
    const loggerErrors = [];
    const listeners = {};
    const logStream = {
      on: (event, handler) => {
        listeners[event] = handler;
      },
    };
    let createWriteStreamCalls = 0;
    let spawnCall;

    spawnAiStorefrontWorker({
      createWriteStreamFn: () => {
        createWriteStreamCalls += 1;
        return logStream;
      },
      logger: {
        error: (entry) => loggerErrors.push(entry),
        info: () => undefined,
      },
      payload: { jobId: 'job-1', merchantId: 'merchant-1', source: 'api' },
      spawnFn: (command, args, options) => {
        spawnCall = { args, command, options };
        return { pid: 1234, unref: () => undefined };
      },
    });

    assert.equal(createWriteStreamCalls, 1);
    assert.equal(spawnCall.options.stdio[1], logStream);
    assert.equal(spawnCall.options.stdio[2], logStream);

    const error = new Error('disk full');
    listeners.error(error);

    assert.deepEqual(loggerErrors, [
      {
        message: 'AI storefront worker trigger log stream failed',
        error,
      },
    ]);
  });

  it('records spawned worker process errors without throwing', () => {
    const loggerErrors = [];
    const listeners = {};
    const error = new Error('spawn ENOENT');

    spawnAiStorefrontWorker({
      createWriteStreamFn: () => ({ on: () => undefined }),
      logger: {
        error: (entry) => loggerErrors.push(entry),
        info: () => undefined,
      },
      payload: { jobId: 'job-1', merchantId: 'merchant-1', source: 'api' },
      spawnFn: () => ({
        on: (event, handler) => {
          listeners[event] = handler;
        },
        pid: 1234,
        unref: () => undefined,
      }),
    });

    listeners.error(error);

    assert.deepEqual(loggerErrors, [
      {
        message: 'AI storefront worker trigger failed to start worker process',
        error,
        jobId: 'job-1',
        merchantId: 'merchant-1',
        source: 'api',
      },
    ]);
  });
});
