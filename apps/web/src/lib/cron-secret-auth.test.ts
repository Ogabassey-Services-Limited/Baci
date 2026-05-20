import { describe, expect, it } from 'vitest';
import { hasValidCronSecret } from './cron-secret-auth';

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe('hasValidCronSecret', () => {
  it('accepts bearer authorization case-insensitively', () => {
    expect(
      hasValidCronSecret(
        headers({ authorization: 'bearer cron-secret' }),
        'cron-secret'
      )
    ).toBe(true);
    expect(
      hasValidCronSecret(
        headers({ authorization: 'BEARER cron-secret' }),
        'cron-secret'
      )
    ).toBe(true);
  });

  it('falls back to the legacy x-cron-secret header', () => {
    expect(
      hasValidCronSecret(
        headers({ 'x-cron-secret': 'cron-secret' }),
        'cron-secret'
      )
    ).toBe(true);
  });

  it('rejects missing or invalid secrets', () => {
    expect(hasValidCronSecret(headers({}), 'cron-secret')).toBe(false);
    expect(
      hasValidCronSecret(
        headers({ authorization: 'Bearer wrong' }),
        'cron-secret'
      )
    ).toBe(false);
    expect(
      hasValidCronSecret(
        headers({ authorization: 'Bearer cron-secret' }),
        undefined
      )
    ).toBe(false);
  });
});
