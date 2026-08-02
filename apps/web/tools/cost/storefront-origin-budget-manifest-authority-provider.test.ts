import { createHash } from 'node:crypto';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveStorefrontDeliveryManifestAuthority } from './storefront-origin-budget-manifest-authority-provider';

describe('production storefront manifest authority provider', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads only the exact private provider or audit receipt bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-manifest-authority-'));
    await chmod(dir, 0o700);
    const path = join(dir, 'receipt.json');
    const bytes = Buffer.from(
      JSON.stringify({
        source: 'audit_verified',
        manifestSha256: 'a'.repeat(64),
        authorityReceiptSha256: 'b'.repeat(64),
        verifiedAt: '2026-08-02T00:00:00.000Z',
      })
    );
    await writeFile(path, bytes, { mode: 0o600 });
    vi.stubEnv('STOREFRONT_MANIFEST_AUTHORITY_RECEIPT_PATH', path);
    vi.stubEnv(
      'STOREFRONT_MANIFEST_AUTHORITY_RECEIPT_FILE_SHA256',
      createHash('sha256').update(bytes).digest('hex')
    );
    await expect(
      resolveStorefrontDeliveryManifestAuthority()
    ).resolves.toMatchObject({ source: 'audit_verified' });
    vi.stubEnv(
      'STOREFRONT_MANIFEST_AUTHORITY_RECEIPT_FILE_SHA256',
      'c'.repeat(64)
    );
    await expect(resolveStorefrontDeliveryManifestAuthority()).rejects.toThrow(
      'hash mismatches'
    );
  });
});
