import { describe, expect, it } from 'vitest';
import { replaceBumpaContactText } from './bumpa-contact-redaction';

describe('replaceBumpaContactText', () => {
  it('leaves text without contact details unchanged', () => {
    expect(
      replaceBumpaContactText('Google Pixel 7a 128GB Premium Used', {
        email: '[redacted-email]',
        phone: '[redacted-phone]',
      })
    ).toBe('Google Pixel 7a 128GB Premium Used');
  });

  it('redacts email addresses and formatted Nigerian phone numbers', () => {
    const result = replaceBumpaContactText(
      'iPhone ada@example.com +234 801 234 5678 / 0801-234-5678 / 234.901.234.5678',
      {
        email: '[redacted-email]',
        phone: '[redacted-phone]',
      }
    );

    expect(result).toBe(
      'iPhone [redacted-email] [redacted-phone] / [redacted-phone] / [redacted-phone]'
    );
  });

  it('does not redact bare 10-digit identifiers without a Nigerian phone prefix', () => {
    expect(
      replaceBumpaContactText('Google Pixel catalog 7890123456', {
        email: '[redacted-email]',
        phone: '[redacted-phone]',
      })
    ).toBe('Google Pixel catalog 7890123456');
  });

  it('preserves phone boundary text when removing contact details', () => {
    const result = replaceBumpaContactText(
      'iPhone 12 / 0801-234-5678 ada@example.com',
      {
        email: ' ',
        phone: '',
      }
    );

    expect(result).toBe('iPhone 12 /   ');
  });
});
