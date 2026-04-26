import { describe, expect, it } from 'vitest';
import {
  JUMIA_NOTIFICATION_MARKER_RETRY_CODES,
  POSTGRES_PREFIXES,
  POSTGREST_CODES,
} from '@/lib/jumia/order-sync-notification-retry-codes';

describe('Jumia notification marker retry codes', () => {
  it('lists only transient PostgREST and PostgreSQL error codes', () => {
    expect(POSTGREST_CODES).toEqual([
      'PGRST000',
      'PGRST001',
      'PGRST002',
      'PGRST003',
    ]);
    expect(POSTGRES_PREFIXES).toEqual(['08', '53', '57', '58']);
    expect(JUMIA_NOTIFICATION_MARKER_RETRY_CODES).toEqual({
      postgrestCodes: POSTGREST_CODES,
      postgresPrefixes: POSTGRES_PREFIXES,
    });
  });

  it('freezes the retry code lists at runtime', () => {
    expect(Object.isFrozen(JUMIA_NOTIFICATION_MARKER_RETRY_CODES)).toBe(true);
    expect(
      Object.isFrozen(JUMIA_NOTIFICATION_MARKER_RETRY_CODES.postgrestCodes)
    ).toBe(true);
    expect(
      Object.isFrozen(JUMIA_NOTIFICATION_MARKER_RETRY_CODES.postgresPrefixes)
    ).toBe(true);
  });
});
