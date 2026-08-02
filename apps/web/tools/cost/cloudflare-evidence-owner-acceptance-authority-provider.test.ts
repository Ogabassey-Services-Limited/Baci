import { createHash } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOwnerAcceptanceAuthority } from './cloudflare-evidence-owner-acceptance-authority-provider';

const environment = { ...process.env };

afterEach(() => {
  process.env = { ...environment };
});

describe('owner acceptance authority provider', () => {
  it('reads only a private receipt matching its independently supplied hash', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-owner-authority-'));
    const receiptPath = join(directory, 'receipt.json');
    const receipt = {
      id: 'owner-approval',
      acceptedAt: '2026-08-01T00:00:00Z',
    };
    const bytes = JSON.stringify(receipt);
    await writeFile(receiptPath, bytes, { mode: 0o600 });
    await chmod(receiptPath, 0o600);
    process.env.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_RECEIPT_PATH = receiptPath;
    process.env.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_RECEIPT_FILE_SHA256 =
      createHash('sha256').update(bytes).digest('hex');

    try {
      await expect(resolveOwnerAcceptanceAuthority()).resolves.toEqual(receipt);
      process.env.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_RECEIPT_FILE_SHA256 =
        'a'.repeat(64);
      await expect(resolveOwnerAcceptanceAuthority()).rejects.toThrow(
        'hash mismatches'
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
