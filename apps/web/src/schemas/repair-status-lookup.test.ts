import { describe, expect, it } from 'vitest';
import { repairStatusLookupSchema } from './repair-status-lookup';

describe('repairStatusLookupSchema', () => {
  it('parses a plain ticket number and normalizes the email', () => {
    const parsed = repairStatusLookupSchema.parse({
      ticketNumber: 1042,
      email: '  Ada@Example.com ',
    });
    expect(parsed).toEqual({ ticketNumber: 1042, email: 'ada@example.com' });
  });

  it('strips decoration from a string ticket number', () => {
    const parsed = repairStatusLookupSchema.parse({
      ticketNumber: '#1042',
      email: 'ada@example.com',
    });
    expect(parsed.ticketNumber).toBe(1042);
  });

  it('rejects a non-positive ticket number', () => {
    expect(
      repairStatusLookupSchema.safeParse({
        ticketNumber: '0',
        email: 'ada@example.com',
      }).success
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      repairStatusLookupSchema.safeParse({
        ticketNumber: 1042,
        email: 'not-an-email',
      }).success
    ).toBe(false);
  });

  it('rejects a missing ticket number', () => {
    expect(
      repairStatusLookupSchema.safeParse({ email: 'ada@example.com' }).success
    ).toBe(false);
  });
});
