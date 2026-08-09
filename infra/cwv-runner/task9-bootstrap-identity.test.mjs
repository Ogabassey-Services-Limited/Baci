import assert from 'node:assert/strict';
import test from 'node:test';

import { checkedTask9Identity } from './task9-bootstrap-identity.mjs';

const sha40 = 'a'.repeat(40);
const sha64 = 'b'.repeat(64);
const digest = 'c'.repeat(64);
const manifest = {
  baseSha: sha40,
  mergeSha: sha64,
  prNumber: 3302,
  reviewedHeadSha: sha40,
};
const policy = { repository: { id: 123, name: 'ogabasseyy/Baci' } };
const input = {
  admissionId: digest,
  deploymentSha: sha64,
  headRef: 'feature/task9',
  workflowId: 42,
};

test('accepts SHA-1 and SHA-256 identities with a valid ref', () => {
  const result = checkedTask9Identity(input, manifest, policy);
  assert.equal(result.mergeSha, sha64);
  assert.equal(result.pullRequest.headRef, 'feature/task9');
});

test('rejects malformed repository and authority fields', () => {
  for (const invalid of [
    { ...input, deploymentSha: sha40 },
    { ...input, workflowId: 0 },
    { ...input, admissionId: 'not-a-digest' },
    { ...input, headRef: '../bad' },
    { ...input, headRef: '-bad' },
    { ...input, headRef: 'feature.lock' },
    { ...input, headRef: '/leading' },
    { ...input, headRef: 'trailing/' },
    { ...input, headRef: 'a..b' },
    { ...input, headRef: 'a@{b' },
    { ...input, headRef: '@' },
    { ...input, headRef: 'feature//task9' },
    { ...input, headRef: '.hidden' },
    { ...input, headRef: 'feature.' },
    { ...input, headRef: 'feature/task9.lock/next' },
  ]) {
    assert.throws(
      () => checkedTask9Identity(invalid, manifest, policy),
      /invalid source identity/
    );
  }
  assert.throws(
    () =>
      checkedTask9Identity(input, manifest, {
        repository: { id: 0, name: 'bad' },
      }),
    /invalid repository identity/
  );
});
