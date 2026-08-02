import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';

test('serializes objects with recursively sorted keys', () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test('hashes objects independently of key insertion order', () => {
  assert.equal(
    canonicalSha256({ b: 2, a: 1 }),
    canonicalSha256({ a: 1, b: 2 })
  );
});

test('preserves array order and nested canonical object order', () => {
  assert.equal(
    canonicalSha256({ values: [{ b: 2, a: 1 }, 3] }),
    canonicalSha256({ values: [{ a: 1, b: 2 }, 3] })
  );
  assert.notEqual(canonicalSha256([1, 2]), canonicalSha256([2, 1]));
});

test('rejects unsupported JSON values', () => {
  const cyclic = {};
  cyclic.self = cyclic;
  const symbolKey = { [Symbol('key')]: 1 };
  const sparseArray = [];
  sparseArray.length = 1;

  for (const value of [
    { value: undefined },
    {
      value() {
        return undefined;
      },
    },
    { value: Symbol('value') },
    { value: 1n },
    { value: Number.NaN },
    { value: Number.POSITIVE_INFINITY },
    cyclic,
    new Date(0),
    symbolKey,
    sparseArray,
  ]) {
    assert.throws(() => canonicalSha256(value), /unsupported JSON value/);
  }
});

test('hashes all supported JSON primitives deterministically', () => {
  for (const value of [null, true, false, 0, -1.5, 'Baci']) {
    assert.equal(canonicalSha256(value), canonicalSha256(value));
  }
});

test('rejects a non-enumerable host apiToken', () => {
  const value = { host: {} };
  Object.defineProperty(value.host, 'apiToken', { value: 'hidden' });

  assert.throws(() => canonicalSha256(value), /unsupported JSON value/);
});

test('rejects accessors without invoking their getters', () => {
  let getterInvoked = false;
  const value = {};
  Object.defineProperty(value, 'secret', {
    enumerable: true,
    get() {
      getterInvoked = true;
      return 'hidden';
    },
  });

  assert.throws(() => canonicalSha256(value), /unsupported JSON value/);
  assert.equal(getterInvoked, false);
});

test('rejects arrays with a custom prototype', () => {
  const value = [];
  Object.setPrototypeOf(value, Object.create(Array.prototype));

  assert.throws(() => canonicalSha256(value), /unsupported JSON value/);
});

test('rejects a sparse array whose extra key compensates for its hole', () => {
  const value = [];
  value.length = 1;
  value.extra = 'hidden';

  assert.throws(() => canonicalSha256(value), /unsupported JSON value/);
});
