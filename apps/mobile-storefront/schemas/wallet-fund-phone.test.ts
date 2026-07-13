import { describe, expect, it } from '@jest/globals';
import { WalletFundPhoneSchema } from '@/schemas/wallet-fund-phone';

describe('WalletFundPhoneSchema', () => {
  it('parses a phone number with the minimum valid length', () => {
    const result = WalletFundPhoneSchema.safeParse({ phone: '0801234567' });

    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace from the phone number', () => {
    const result = WalletFundPhoneSchema.safeParse({
      phone: '  08012345678  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('08012345678');
    }
  });

  it('rejects an empty phone number', () => {
    const result = WalletFundPhoneSchema.safeParse({ phone: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toEqual({
        phone: ['Valid phone number required'],
      });
    }
  });

  it('rejects nine-digit phone numbers', () => {
    const result = WalletFundPhoneSchema.safeParse({ phone: '123456789' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toEqual({
        phone: ['Valid phone number required'],
      });
    }
  });

  it('rejects a missing phone field', () => {
    const result = WalletFundPhoneSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
