import { describe, expect, it } from 'vitest';
import { createCacVerificationFormData } from './cac-verification-upload';

describe('createCacVerificationFormData', () => {
  it('includes the authorized merchant ID in the certificate upload', () => {
    const file = new File(['certificate'], 'certificate.pdf', {
      type: 'application/pdf',
    });

    const formData = createCacVerificationFormData({
      file,
      rcNumber: 'RC-999',
      approvedName: 'Test Company',
      merchantId: '11111111-1111-4111-8111-111111111111',
    });

    expect(formData.get('merchantId')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(formData.get('file')).toBe(file);
  });
});
