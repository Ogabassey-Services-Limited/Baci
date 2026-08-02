import { describe, expect, it } from 'vitest';
import { prepareReadTokenRevocationProcessEnvironment } from './cloudflare-evidence-read-revocation-environment';

const receiptPath = '/private/evidence/read-revocation.json';
const modulePath = '/workspace/readback.ts';
const moduleSha256 = 'a'.repeat(64);

describe('prepareReadTokenRevocationProcessEnvironment', () => {
  it('allowlists the receipt authority without forwarding credentials', () => {
    expect(
      prepareReadTokenRevocationProcessEnvironment({
        PATH: '/attacker/bin',
        TMPDIR: '/private/tmp',
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: receiptPath,
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: modulePath,
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: moduleSha256,
        SECRET: 'do-not-forward',
      })
    ).toEqual({
      PATH: expect.any(String),
      TMPDIR: '/private/tmp',
      EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: receiptPath,
      EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: modulePath,
      EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: moduleSha256,
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

  it('requires absolute receipt/module paths and a SHA-256 descriptor', () => {
    expect(() =>
      prepareReadTokenRevocationProcessEnvironment({
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: 'receipt.json',
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: modulePath,
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: moduleSha256,
      })
    ).toThrow('RECEIPT_PATH must be absolute');
    expect(() =>
      prepareReadTokenRevocationProcessEnvironment({
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: receiptPath,
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: 'readback.ts',
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: moduleSha256,
      })
    ).toThrow('MODULE must be absolute');
    expect(() =>
      prepareReadTokenRevocationProcessEnvironment({
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH: receiptPath,
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: modulePath,
        EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: 'invalid',
      })
    ).toThrow('SHA-256 digest');
  });
});
