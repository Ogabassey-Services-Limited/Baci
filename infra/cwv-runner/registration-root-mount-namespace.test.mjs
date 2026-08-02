import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyRegistrationTokenMount } from './registration-root-mount-namespace.mjs';

test('requires exactly one token target before removal and none after removal', () => {
  const present = Buffer.from(
    '1 2 0:1 / /run/secrets/runner-registration-token ro - tmpfs tmpfs ro\n'
  );
  assert.doesNotThrow(() => verifyRegistrationTokenMount(present, true));
  assert.doesNotThrow(() =>
    verifyRegistrationTokenMount(Buffer.alloc(0), false)
  );
  assert.throws(
    () => verifyRegistrationTokenMount(present, false),
    /registration inspection refused/
  );
  const duplicate = Buffer.from(
    '1 2 0:1 / /run/secrets/runner-registration-token ro - tmpfs tmpfs ro\n' +
      '2 3 0:1 / /run/secrets/runner-registration-token ro - tmpfs tmpfs ro\n'
  );
  assert.throws(
    () => verifyRegistrationTokenMount(duplicate, true),
    /registration inspection refused/
  );
});
