import { describe, expect, it } from 'vitest';
import { staffAcceptSchema } from './staff-accept';

describe('staffAcceptSchema', () => {
  it('successfully validates standard alphanumeric tokens with hyphens and underscores', () => {
    const validTokens = [
      'a', // 1-character boundary case
      'token-abc-123',
      'invite_token_123',
      'abc123XYZ',
      'some-very-long-token-with-many-parts_and-12345',
      'a'.repeat(255), // 255-character maximum boundary case
    ];

    for (const token of validTokens) {
      const result = staffAcceptSchema.safeParse({ token });
      expect(result.success).toBe(true);
    }
  });

  it('rejects empty or missing tokens', () => {
    const invalidInputs = [{ token: '' }, {}, { token: undefined }];

    for (const input of invalidInputs) {
      const result = staffAcceptSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.format();
        expect(error.token?._errors[0]).toBe('Invitation token is required');
      }
    }
  });

  it('rejects tokens exceeding maximum length limits', () => {
    const longToken = 'a'.repeat(256);
    const result = staffAcceptSchema.safeParse({ token: longToken });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.format();
      expect(error.token?._errors[0]).toBe('Invalid invitation token format');
    }
  });

  it('rejects tokens containing invalid characters', () => {
    const invalidTokens = [
      'token;drop table users;',
      'token<script>',
      'token name with spaces',
      'token@123',
    ];

    for (const token of invalidTokens) {
      const result = staffAcceptSchema.safeParse({ token });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.format();
        expect(error.token?._errors[0]).toBe(
          'Invalid invitation token characters'
        );
      }
    }
  });
});
