import assert from 'node:assert/strict';
import test from 'node:test';

const moduleUrl = new URL('./registration-root-contract.mjs', import.meta.url);
const canonical = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);
const request = (operation, context = {}) =>
  Buffer.from(`${canonical({ context, operation, schemaVersion: 1 })}\n`);

test('rejects unknown operations, caller paths or argv, and invalid phases', async () => {
  const { parseRegistrationRootRequest } = await import(moduleUrl);
  for (const bytes of [
    request('arbitrary-operation'),
    request('create-token-layout', { path: '/tmp/escape' }),
    request('create-registration-container', { argv: ['/bin/sh'] }),
    request('inspect-registration', { phase: 'assigned' }),
    Buffer.from(
      `${JSON.stringify({ schemaVersion: 1, operation: 'release-lock', context: {} })}\n`
    ),
  ])
    assert.throws(
      () => parseRegistrationRootRequest(bytes),
      /registration root operation refused/
    );
});

test('accepts only exact operation-specific request contexts', async () => {
  const { parseRegistrationRootRequest } = await import(moduleUrl);
  assert.deepEqual(parseRegistrationRootRequest(request('release-lock')), {
    context: {},
    operation: 'release-lock',
    schemaVersion: 1,
  });
  assert.deepEqual(
    parseRegistrationRootRequest(
      request('inspect-registration', { phase: 'node-ready' })
    ).context,
    { phase: 'node-ready' }
  );
  assert.deepEqual(
    parseRegistrationRootRequest(request('write-registration-token')).context,
    {}
  );
  assert.throws(
    () =>
      parseRegistrationRootRequest(
        request('write-registration-token', { token: 'not-transported' })
      ),
    /registration root operation refused/
  );
});
