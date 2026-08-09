import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';
import { validGitRef } from './git-ref-validator.mjs';
import { readHeldTask9File } from './task9-held-file.mjs';

const SHA = /^[a-f0-9]{40}$/;
const fail = () => {
  throw new TypeError('invalid preserved PR metadata');
};

// The owner-published review literal is separate from the caller-controlled
// metadata/digest files; matching those files alone never authenticates a PR.

export function readTask9PrMetadata(
  path,
  digestPath,
  { maxBytes = 1_048_576, reviewedSha256 } = {}
) {
  const input = readHeldTask9File(path, 0o600, { maxBytes });
  const digest = readHeldTask9File(digestPath, 0o600, { maxBytes: 256 });
  try {
    const actualSha256 = createHash('sha256').update(input.bytes).digest('hex');
    if (
      !/^[a-f0-9]{64}$/.test(reviewedSha256 ?? '') ||
      reviewedSha256 !== actualSha256 ||
      digest.bytes.toString() !== `${actualSha256}\n`
    )
      fail();
    let value;
    try {
      value = JSON.parse(input.bytes);
    } catch {
      fail();
    }
    if (
      !value ||
      Array.isArray(value) ||
      typeof value !== 'object' ||
      canonicalJson(value) !== input.bytes.toString() ||
      canonicalJson(Object.keys(value).sort()) !==
        canonicalJson(
          ['baseSha', 'headRef', 'number', 'reviewedHeadSha'].sort()
        ) ||
      !SHA.test(value.baseSha) ||
      !SHA.test(value.reviewedHeadSha) ||
      !Number.isSafeInteger(value.number) ||
      value.number < 1 ||
      typeof value.headRef !== 'string' ||
      !validGitRef(value.headRef)
    )
      fail();
    return value;
  } finally {
    close(input, digest);
  }
}

function close(input, digest) {
  input.close?.();
  digest.close?.();
}
