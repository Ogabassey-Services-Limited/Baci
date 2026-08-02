import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { createGithubTransport } from './cwv-runner-authority-runtime.mjs';

test('aborts a GitHub response that keeps making slow progress past the wall-clock deadline', async () => {
  const response = new EventEmitter();
  response.statusCode = 200;
  const request = new EventEmitter();
  const timers = [];
  let destroyed;
  request.destroy = (error) => {
    destroyed = error;
    request.emit('error', error);
  };
  request.end = () => {
    responseCallback(response);
    response.emit('data', Buffer.from('{'));
  };
  let responseCallback;
  const transport = createGithubTransport({
    clearTimeout: (timer) => {
      timer.cleared = true;
    },
    request: (_options, callback) => {
      responseCallback = callback;
      return request;
    },
    setTimeout: (callback, delay) => {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    },
  });

  const pending = transport.request({
    method: 'GET',
    path: '/repos/ogabasseyy/Baci',
    token: Buffer.from('token'),
  });
  timers[0].callback();

  await assert.rejects(pending, /GitHub request timed out/);
  assert.match(destroyed.message, /GitHub request timed out/);
  assert.equal(timers[0].delay, 5000);
  assert.equal(timers[0].cleared, true);
});
