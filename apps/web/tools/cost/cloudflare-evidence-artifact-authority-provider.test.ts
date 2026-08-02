import { createHash } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveQualificationArtifactAuthority } from './cloudflare-evidence-artifact-authority-provider';

const environment = { ...process.env };

afterEach(() => {
  process.env = { ...environment };
});

describe('qualification artifact authority provider', () => {
  it('reads only a private receipt matching its independently supplied hash', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-artifact-authority-'));
    const receiptPath = join(directory, 'receipt.json');
    const receipt = { toolingMergeSha: 'a'.repeat(40), artifacts: [] };
    const bytes = JSON.stringify(receipt);
    await writeFile(receiptPath, bytes, { mode: 0o600 });
    await chmod(receiptPath, 0o600);
    process.env.EVIDENCE_ARTIFACT_AUTHORITY_RECEIPT_PATH = receiptPath;
    process.env.EVIDENCE_ARTIFACT_AUTHORITY_RECEIPT_FILE_SHA256 = createHash(
      'sha256'
    )
      .update(bytes)
      .digest('hex');

    try {
      await expect(resolveQualificationArtifactAuthority()).resolves.toEqual(
        receipt
      );
      await chmod(receiptPath, 0o644);
      await expect(resolveQualificationArtifactAuthority()).rejects.toThrow(
        'is not private'
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
