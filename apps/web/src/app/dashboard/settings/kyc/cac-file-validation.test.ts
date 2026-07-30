import { describe, expect, it } from 'vitest';
import { validateCacCertificateFile } from './cac-file-validation';

describe('validateCacCertificateFile', () => {
  it('accepts a PDF certificate within the upload size limit', () => {
    expect(
      validateCacCertificateFile(
        new File(['certificate'], 'certificate.pdf', {
          type: 'application/pdf',
        })
      )
    ).toEqual({ kind: 'valid' });
  });

  it('rejects an unsupported certificate MIME type', () => {
    expect(
      validateCacCertificateFile(
        new File(['certificate'], 'certificate.exe', {
          type: 'application/octet-stream',
        })
      )
    ).toEqual({ kind: 'invalid-type' });
  });
});
