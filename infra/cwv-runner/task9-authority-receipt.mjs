import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';
import { readHeldTask9File } from './task9-held-file.mjs';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const fail = () => { throw new TypeError('invalid Task 9 authority receipt'); };

export function readTask9AuthorityReceipt(path, digestPath, reviewedDigest) {
  const input = readHeldTask9File(path, 0o600, { maxBytes: 1_048_576 });
  const digest = readHeldTask9File(digestPath, 0o600, { maxBytes: 256 });
  try {
    const hash = createHash('sha256').update(input.bytes).digest('hex');
    if (!DIGEST.test(reviewedDigest ?? '') || reviewedDigest !== hash || digest.bytes.toString() !== `${hash}\n`) fail();
    let value;
    try { value = JSON.parse(input.bytes); } catch { fail(); }
    if (!value || Array.isArray(value) || canonicalJson(value) !== input.bytes.toString()) fail();
    if (canonicalJson(Object.keys(value).sort()) !== canonicalJson(['coherence','deploymentSha','metadataSha256','repository','status','workflow'].sort())) fail();
    if (!SHA.test(value.deploymentSha) || value.status !== 'success' || value.coherence !== 'success' || !DIGEST.test(value.metadataSha256)) fail();
    if (!value.repository || typeof value.repository.name !== 'string' || !Number.isSafeInteger(value.repository.id) || value.repository.id < 1) fail();
    if (!value.workflow || value.workflow.path !== '.github/workflows/deploy.yml' || !Number.isSafeInteger(value.workflow.id) || value.workflow.id < 1 || value.workflow.sha !== value.deploymentSha) fail();
    return value;
  } finally {
    input.close?.();
    digest.close?.();
  }
}
