import { describe, expect, it } from '@jest/globals';
import { ProfileSchema } from '@/schemas/profile-edit';

describe('ProfileSchema', () => {
  it('parses names and an optional phone number', () => {
    const result = ProfileSchema.safeParse({
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '',
    });

    expect(result.success).toBe(true);
  });

  it('parses names when the phone number is omitted', () => {
    const result = ProfileSchema.safeParse({
      first_name: 'Ada',
      last_name: 'Lovelace',
    });

    expect(result.success).toBe(true);
  });

  it('parses a phone number with the minimum valid length', () => {
    const result = ProfileSchema.safeParse({
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '0801234567',
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing names and undersized phone numbers', () => {
    const result = ProfileSchema.safeParse({
      first_name: '',
      last_name: '',
      phone: '123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toEqual({
        first_name: ['First name is required'],
        last_name: ['Last name is required'],
        phone: ['Valid phone number required'],
      });
    }
  });

  it('rejects whitespace names and nine-digit phone numbers', () => {
    const result = ProfileSchema.safeParse({
      first_name: '   ',
      last_name: '   ',
      phone: '123456789',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toEqual({
        first_name: ['First name is required'],
        last_name: ['Last name is required'],
        phone: ['Valid phone number required'],
      });
    }
  });
});
