import { describe, expect, it } from 'vitest';
import { conversionEventRequestSchema } from './conversion-event';

const validRequest = {
  custom_data: { currency: 'NGN', value: 100 },
  event_name: 'START_CHECKOUT',
  event_source: 'mobile_app',
  event_time: 1_783_856_000,
  user_data: {},
} as const;

describe('conversionEventRequestSchema', () => {
  it('accepts a bounded mobile conversion', () => {
    expect(conversionEventRequestSchema.safeParse(validRequest).success).toBe(
      true
    );
  });

  it('rejects caller-owned trust levels', () => {
    expect(
      conversionEventRequestSchema.safeParse({
        ...validRequest,
        trust_level: 'server',
      }).success
    ).toBe(false);
  });

  it('rejects an invalid event timestamp', () => {
    expect(
      conversionEventRequestSchema.safeParse({
        ...validRequest,
        event_time: -1,
      }).success
    ).toBe(false);
  });

  it('rejects a malformed optional merchant identifier', () => {
    expect(
      conversionEventRequestSchema.safeParse({
        ...validRequest,
        merchant_id: 'not-a-uuid',
      }).success
    ).toBe(false);
  });
});
