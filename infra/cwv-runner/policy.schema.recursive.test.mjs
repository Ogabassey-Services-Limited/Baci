import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseRunnerPolicy } from './policy.schema.mjs';

const policy = JSON.parse(
  await readFile(new URL('./policy.json', import.meta.url), 'utf8')
);
const decodedPolicy = parseRunnerPolicy(policy);

function mutate(pointer, value, operation = 'set') {
  const candidate = structuredClone(policy);
  const parts = pointer.split('/').slice(1);
  const key = parts.pop();
  let parent = candidate;
  for (const part of parts) parent = parent[part];
  if (operation === 'delete') delete parent[key];
  else parent[key] = value;
  return candidate;
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const nestedValue of Object.values(value)) assertDeepFrozen(nestedValue);
}

test('deep-freezes the accepted nested policy before consumers receive it', () => {
  const candidate = structuredClone(policy);
  Object.freeze(candidate);
  const parsed = parseRunnerPolicy(candidate);
  assertDeepFrozen(parsed);
  assert.throws(() => parsed.ruleset.rules.push('creation'), TypeError);
});

test('freezes the bounded immutable artifact media-type roles', () => {
  const pointer = '/supplyChainProvenance/immutableArtifactMediaTypes';
  const mediaTypes =
    decodedPolicy.supplyChainProvenance.immutableArtifactMediaTypes;
  assert.deepEqual(mediaTypes, {
    commandSettings: ['text/plain'],
    'node.archive': ['application/x-xz', 'application/octet-stream'],
    'node.checksums': ['text/plain'],
    'node.signature': ['application/pgp-signature', 'application/octet-stream'],
    'node.keyring': ['application/octet-stream'],
    'runner.archive': ['application/gzip', 'application/octet-stream'],
    'pnpm.archive': ['application/gzip', 'application/octet-stream'],
    'chrome.archive': [
      'application/vnd.debian.binary-package',
      'application/octet-stream',
    ],
    'chrome.inRelease': ['text/plain'],
    'chrome.packages': [
      'application/gzip',
      'application/x-gzip',
      'application/octet-stream',
    ],
    'chrome.signingKey': ['application/pgp-keys', 'application/octet-stream'],
    'ownerCli.checksums': ['text/plain'],
    'ownerCli.archive': ['application/zip', 'application/octet-stream'],
  });
  const missing = structuredClone(policy);
  delete missing.supplyChainProvenance.immutableArtifactMediaTypes;
  const cases = [
    missing,
    mutate(`${pointer}/unknown`, ['application/json']),
    mutate(`${pointer}/commandSettings`, ['text/plain', 'application/json']),
  ];
  for (const candidate of cases)
    assert.throws(() => parseRunnerPolicy(candidate), /invalid runner policy/);
});

test('rejects missing, changed, extra, and reordered values recursively', () => {
  const cases = [];
  const visit = (value, pointer = '') => {
    if (Array.isArray(value)) {
      cases.push(mutate(pointer, [...value, '__extra__']));
      const reversed = [...value].reverse();
      if (JSON.stringify(value) !== JSON.stringify(reversed))
        cases.push(mutate(pointer, reversed));
      value.forEach((_, index) => {
        cases.push(
          mutate(
            pointer,
            value.filter((__, entry) => entry !== index)
          )
        );
      });
      value.forEach((item, index) => {
        visit(item, `${pointer}/${index}`);
      });
      return;
    }
    if (value !== null && typeof value === 'object') {
      cases.push(mutate(`${pointer}/unexpected`, true));
      for (const [key, item] of Object.entries(value)) {
        const childPointer = `${pointer}/${key}`;
        cases.push(mutate(childPointer, undefined, 'delete'));
        visit(item, childPointer);
      }
      return;
    }
    const drift =
      typeof value === 'boolean'
        ? !value
        : typeof value === 'number'
          ? value + 1
          : `${value}-drift`;
    cases.push(mutate(pointer, drift));
  };
  visit(policy);
  for (const candidate of cases)
    assert.throws(() => parseRunnerPolicy(candidate), /invalid runner policy/);
});
