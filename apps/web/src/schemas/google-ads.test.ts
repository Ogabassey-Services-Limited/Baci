import { describe, expect, it } from 'vitest';
import {
  googleAdsOAuthCallbackQuerySchema,
  googleAdsSpendQuerySchema,
  googleAdsSyncRequestSchema,
} from './google-ads';

describe('Google Ads schemas', () => {
  it('normalizes a hyphenated customer id', () => {
    expect(
      googleAdsSpendQuerySchema.parse({ customerId: '123-456-7890' })
    ).toMatchObject({ customerId: '1234567890' });
  });

  it('rejects an inverted date range', () => {
    expect(() =>
      googleAdsSpendQuerySchema.parse({
        endDate: '2026-08-01',
        startDate: '2026-08-02',
      })
    ).toThrow();
  });

  it('accepts a provider error callback without exposing extra query fields', () => {
    expect(
      googleAdsOAuthCallbackQuerySchema.parse({ error: 'access_denied' })
    ).toEqual({ error: 'access_denied' });
  });

  it('rejects sync windows longer than 90 days', () => {
    expect(() =>
      googleAdsSyncRequestSchema.parse({
        endDate: '2026-08-21',
        startDate: '2026-01-01',
      })
    ).toThrow();
  });
});
