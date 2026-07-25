import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validatePinnedAnswerSet } from './owner-api-transport-security.mjs';

const httpSource = await readFile(
  new URL('./owner-api-transport-http.mjs', import.meta.url),
  'utf8'
);

test('accepts public endpoints and rejects every reserved address family represented by policy', () => {
  assert.deepEqual(
    validatePinnedAnswerSet('api.github.com', [
      '8.8.8.8',
      '2606:4700:4700::1111',
    ]),
    ['2606:4700:4700::1111', '8.8.8.8']
  );
  for (const address of [
    '0.1.2.3',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.0.0.1',
    '192.0.2.1',
    '192.88.99.1',
    '192.168.0.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:8.8.8.8',
    '64:ff9b:1::1',
    '100::1',
    '2001::1',
    '2001:db8::1',
    '2002::1',
    'fc00::1',
    'fe80::1',
    'ff00::1',
  ])
    assert.throws(
      () => validatePinnedAnswerSet('api.github.com', [address]),
      /peer address/
    );
});

test('uses one closed connection and separately enforces sealed transport deadlines', () => {
  assert.match(httpSource, /agent: false/);
  assert.match(httpSource, /Connection: 'close'/);
  assert.match(httpSource, /joinDuplicateHeaders: false/);
  assert.match(httpSource, /deadlineMonotonicMs: state\.deadlineMonotonicMs/);
  assert.match(httpSource, /connectDeadlineMonotonicMs/);
  assert.match(httpSource, /headersDeadlineMonotonicMs/);
  assert.match(httpSource, /body inactivity deadline/);
  assert.match(httpSource, /overallDeadlineMonotonicMs/);
  assert.doesNotMatch(httpSource, /const TIMEOUT_MS|timeout: timeoutMs/);
  assert.doesNotMatch(httpSource, /\blocation\s*:/i);
});
