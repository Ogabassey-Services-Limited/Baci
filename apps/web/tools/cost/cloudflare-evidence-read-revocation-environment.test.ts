import { describe, expect, it } from 'vitest';
import { prepareReadTokenRevocationProcessEnvironment } from './cloudflare-evidence-read-revocation-environment';

const receiptPath = '/private/evidence/read-revocation.json';

describe('prepareReadTokenRevocationProcessEnvironment', () => {
  it('allowlists the receipt authority without forwarding credentials', () => {
    expect(
      prepareReadTokenRevocationProcessEnvironment({
        PATH: '/attacker/bin',
        TMPDIR: '/private/tmp',
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: receiptPath,
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: '/attacker/readback.ts',
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: 'a'.repeat(64),
        SECRET: 'do-not-forward',
      })
    ).toEqual({
      PATH: expect.any(String),
      TMPDIR: '/private/tmp',
      EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: receiptPath,
    });
  });

  it.each([
    ['CLOUDFLARE_READ_TOKEN', 'read'],
    ['CLOUDFLARE_WRITE_TOKEN', 'write'],
  ])('rejects an inherited %s', (name, value) => {
    expect(() =>
      prepareReadTokenRevocationProcessEnvironment({
        [name]: value,
      })
    ).toThrow('must not receive a Cloudflare credential');
  });

  it('requires an absolute revocation receipt path', () => {
    expect(() =>
      prepareReadTokenRevocationProcessEnvironment({
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: 'receipt.json',
      })
    ).toThrow('RECEIPT_PATH must be absolute');
  });
});
