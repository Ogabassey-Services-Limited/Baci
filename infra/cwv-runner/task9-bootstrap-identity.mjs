import { canonicalJson } from './canonical-json.mjs';

const DIGEST = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const fail = (message) => {
  throw new TypeError(message);
};
function validRef(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value === '@' ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('..')
  )
    return false;
  return value
    .split('/')
    .every(
      (part) =>
        part &&
        part !== '.' &&
        part !== '..' &&
        !part.startsWith('.') &&
        !part.endsWith('.') &&
        !part.endsWith('.lock') &&
        !part.startsWith('-') &&
        !part.includes('@{') &&
        /^[A-Za-z0-9._-]+$/.test(part)
    );
}

export function checkedTask9Identity(input, manifest, policy) {
  const repository = policy.repository;
  if (
    !repository ||
    canonicalJson(Object.keys(repository).sort()) !==
      canonicalJson(['id', 'name'].sort()) ||
    !Number.isSafeInteger(repository.id) ||
    repository.id < 1 ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.name)
  )
    fail('invalid repository identity');
  if (
    !SHA.test(input.deploymentSha) ||
    input.deploymentSha !== manifest.mergeSha ||
    !validRef(input.headRef) ||
    !Number.isSafeInteger(input.workflowId) ||
    input.workflowId < 1 ||
    !DIGEST.test(input.admissionId)
  )
    fail('invalid source identity');
  return {
    base: { ref: 'refs/heads/main', sha: manifest.baseSha },
    exactRun: {
      admissionId: input.admissionId,
      workflow: {
        id: input.workflowId,
        path: '.github/workflows/cwv-runner-attestation.yml',
        ref: 'refs/heads/main',
      },
    },
    mergeSha: manifest.mergeSha,
    pullRequest: { headRef: input.headRef, number: manifest.prNumber },
    ref: `refs/pull/${manifest.prNumber}/merge`,
    repository,
    reviewedSha: manifest.reviewedHeadSha,
  };
}
