import { describe, expect, it } from 'vitest';
import { externalReadTokenRevocationDependencies } from './cloudflare-evidence-read-revocation.test-fixtures';

describe('externalReadTokenRevocationDependencies', () => {
  it('returns immutable-looking provider evidence for the requested read token', async () => {
    const dependencies = externalReadTokenRevocationDependencies(
      'read-token',
      '2026-08-03T00:00:00.000Z',
      'a'.repeat(64)
    );

    const readback = await dependencies.client.readBack('read-token');

    expect(dependencies.revocationReceipt).toEqual({
      tokenId: 'read-token',
      status: 'revoked',
      providerReceiptSha256: 'a'.repeat(64),
      observedAt: '2026-08-03T00:00:00.000Z',
    });
    expect(readback).toMatchObject({
      tokenId: 'read-token',
      status: 'inactive',
      auditReceiptSha256: 'a'.repeat(64),
    });
  });
});
