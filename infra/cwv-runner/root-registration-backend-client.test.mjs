import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  createRegistrationBackendClient,
  executeRegistrationBackend,
} from './root-registration-backend-client.mjs';

function childFor({ code = 0, stderr = '', stdout = '{}\n' } = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdio = [child.stdin, child.stdout, child.stderr, new PassThrough()];
  child.kill = () => undefined;
  process.nextTick(() => {
    child.stdout.end(stdout);
    child.stderr.end(stderr);
    child.emit('close', code);
  });
  return child;
}

test('executes the sealed backend with one bounded canonical stdin request', async () => {
  let invocation;
  let received = '';
  const child = childFor();
  child.stdin.on('data', (chunk) => {
    received += chunk.toString('utf8');
  });
  const result = await executeRegistrationBackend(
    '{"context":{},"operation":"release-lock","schemaVersion":1}',
    {
      spawn: (file, argv, options) => {
        invocation = { argv, file, options };
        return child;
      },
    }
  );
  assert.deepEqual(invocation, {
    argv: [
      '/srv/baci-cwv/sealed/registration-root-operations.mjs',
      '--execute',
    ],
    file: '/usr/bin/node',
    options: {
      env: { LC_ALL: 'C.UTF-8', TZ: 'Etc/UTC' },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    },
  });
  assert.equal(
    received,
    '{"context":{},"operation":"release-lock","schemaVersion":1}\n'
  );
  assert.equal(result, '{}\n');
});

test('writes a registration token to only the inherited binary descriptor then wipes it', async () => {
  const child = childFor();
  const token = Buffer.from(`${'A'.repeat(29)}\n`);
  let received = Buffer.alloc(0);
  child.stdio[3].on('data', (chunk) => {
    received = Buffer.concat([received, chunk]);
  });
  await executeRegistrationBackend(
    '{"context":{},"operation":"write-registration-token","schemaVersion":1}',
    { secret: token, spawn: () => child }
  );
  assert.deepEqual(received, Buffer.from(`${'A'.repeat(29)}\n`));
  assert.equal(
    token.every((byte) => byte === 0),
    true
  );
});

test('refuses backend stderr and oversized requests without disclosing their contents', async () => {
  await assert.rejects(
    executeRegistrationBackend(
      '{"context":{},"operation":"release-lock","schemaVersion":1}',
      {
        spawn: () => childFor({ stderr: 'refused\n' }),
      }
    ),
    /root operation refused/
  );
  assert.throws(
    () =>
      executeRegistrationBackend('x'.repeat(16_385), {
        spawn: () => childFor(),
      }),
    /root operation refused/
  );
  assert.throws(
    () =>
      executeRegistrationBackend('é'.repeat(8_192), {
        spawn: () => childFor(),
      }),
    /root operation refused/
  );
  await assert.rejects(
    executeRegistrationBackend(
      '{"context":{},"operation":"release-lock","schemaVersion":1}',
      {
        spawn: () => {
          throw new Error('unavailable');
        },
      }
    ),
    /root operation refused/
  );
});

test('terminates a live child before rejecting a stdin error', async () => {
  const child = childFor();
  let signal;
  child.kill = (value) => {
    signal = value;
  };
  const pending = executeRegistrationBackend(
    '{"context":{},"operation":"release-lock","schemaVersion":1}',
    { spawn: () => child }
  );
  child.stdin.emit('error', new Error('broken pipe'));
  await assert.rejects(pending, /root operation refused/);
  assert.equal(signal, 'SIGKILL');
});

test('bounds a silent child, kills it, and wipes a pending inherited secret', async () => {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdio = [child.stdin, child.stdout, child.stderr, new PassThrough()];
  let signal;
  let timeout;
  child.kill = (value) => {
    signal = value;
  };
  const secret = Buffer.from(`${'A'.repeat(29)}\n`);
  const pending = executeRegistrationBackend(
    '{"context":{},"operation":"write-registration-token","schemaVersion":1}',
    {
      clearTimeout: () => undefined,
      secret,
      setTimeout: (callback) => {
        timeout = callback;
        return 1;
      },
      spawn: () => child,
    }
  );
  timeout();
  await assert.rejects(pending, /root operation refused/);
  assert.equal(signal, 'SIGKILL');
  assert.equal(
    secret.every((byte) => byte === 0),
    true
  );
});

test('keeps one fixed-argv backend alive for the complete root transaction', async () => {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdio = [child.stdin, child.stdout, child.stderr, new PassThrough()];
  child.kill = () => undefined;
  const received = [];
  child.stdin.on('data', (chunk) => {
    received.push(chunk.toString('utf8'));
    child.stdout.write('{}\n');
  });
  let spawns = 0;
  const backend = createRegistrationBackendClient({
    spawn: () => {
      spawns += 1;
      return child;
    },
  });
  assert.equal(await backend.execute('{"operation":"first"}'), '{}\n');
  assert.equal(await backend.execute('{"operation":"second"}'), '{}\n');
  assert.equal(spawns, 1);
  assert.deepEqual(received, [
    '{"operation":"first"}\n',
    '{"operation":"second"}\n',
  ]);
  await backend.close();
});
