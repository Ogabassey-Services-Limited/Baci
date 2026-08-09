import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';
import { readHeldTask9File } from './task9-held-file.mjs';

const SHA = /^[a-f0-9]{40}$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const fail = () => {
  throw new TypeError('invalid preserved PR metadata');
};

export function readTask9PrMetadata(path, digestPath) {
  const input = readHeldTask9File(path, 0o600);
  const digest = readHeldTask9File(digestPath, 0o600);
  try {
    if (
      digest.bytes.toString() !==
      `${createHash('sha256').update(input.bytes).digest('hex')}\n`
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
      !REF.test(value.headRef) ||
      value.headRef.includes('..') ||
      value.headRef.includes('@{')
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
