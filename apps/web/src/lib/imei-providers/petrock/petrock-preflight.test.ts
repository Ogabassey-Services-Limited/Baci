import { describe, expect, it } from 'vitest';
import { validatePetrockProductSnapshot } from './petrock-preflight';

const binding = {
  costUsd: 0.019,
  deviceCategories: ['smartphone'] as const,
  orderFieldName: 'IMEI',
  productId: '1955',
  provider: 'petrock' as const,
};

const snapshot = {
  active: true,
  currency: 'USD',
  order_field_name: 'IMEI',
  price_usd: 0.019,
  product_id: '1955',
  synced_at: '2026-07-10T10:00:00.000Z',
};

describe('validatePetrockProductSnapshot', () => {
  it('accepts a fresh matching snapshot within the price ceiling', () => {
    expect(
      validatePetrockProductSnapshot({
        binding,
        now: new Date('2026-07-11T10:00:00.000Z'),
        snapshot,
      })
    ).toEqual({ ok: true });
  });

  it.each([
    [
      'stale snapshot',
      { ...snapshot, synced_at: '2026-07-08T09:59:59.000Z' },
      'PROVIDER_PRICE_STALE',
    ],
    [
      'future-dated snapshot',
      { ...snapshot, synced_at: '2026-07-11T10:00:01.000Z' },
      'PROVIDER_PRICE_STALE',
    ],
    ['price drift', { ...snapshot, price_usd: 0.024 }, 'PROVIDER_PRICE_DRIFT'],
    [
      'field drift',
      { ...snapshot, order_field_name: 'IMEI ' },
      'PROVIDER_FIELD_DRIFT',
    ],
    [
      'currency drift',
      { ...snapshot, currency: 'EUR' },
      'PROVIDER_CURRENCY_DRIFT',
    ],
  ])('fails closed for %s', (_name, candidate, code) => {
    expect(
      validatePetrockProductSnapshot({
        binding,
        now: new Date('2026-07-11T10:00:00.000Z'),
        snapshot: candidate,
      })
    ).toMatchObject({ code, ok: false });
  });
});
