import assert from 'node:assert/strict';
import test from 'node:test';

import { readRegistrationTokenFd } from './registration-token-fd.mjs';

test('reads one bounded binary token from the dedicated descriptor and wipes overflow storage', () => {
  const token = Buffer.from(`${'A'.repeat(29)}\n`);
  let offset = 0;
  let overflow;
  const bytes = readRegistrationTokenFd(3, {
    readSync: (_fd, target, targetOffset, length) => {
      if (length === 1) {
        target[0] = 0x41;
        overflow = target;
        return 0;
      }
      const count = Math.min(length, token.length - offset);
      token.copy(target, targetOffset, offset, offset + count);
      offset += count;
      return count;
    },
  });
  assert.deepEqual(bytes, token);
  assert.equal(overflow[0], 0);
});

test('refuses a token descriptor other than the dedicated inherited fd', () => {
  assert.throws(
    () => readRegistrationTokenFd(4),
    /registration token fd refused/
  );
});
