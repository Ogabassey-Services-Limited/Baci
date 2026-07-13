import { describe, expect, it } from 'vitest';
import { normalizePetrockCatalog } from './petrock-catalog';

describe('normalizePetrockCatalog', () => {
  it('filters to IMEI products and preserves exact order fields', () => {
    const syncedAt = new Date('2026-07-10T12:00:00.000Z');
    const rows = normalizePetrockCatalog(
      {
        data: {
          categories: {
            C164: { name: 'Apple IMEI Services' },
            C2: { name: 'Gift Cards' },
          },
          currency: 'USD',
          products: {
            '688': {
              cids: ['C164'],
              fields: [
                {
                  name: 'IMEI or Serial Number ',
                  required: true,
                  type: 'text',
                },
              ],
              name: 'Apple Full Check',
              price: '0.031',
              type: 'imei',
            },
            gift: {
              cids: ['C2'],
              fields: [{ name: 'Email' }],
              name: 'Gift Card',
              price: 10,
              type: 'digital',
            },
          },
        },
      },
      syncedAt
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category_id: 'C164',
      category_name: 'Apple IMEI Services',
      currency: 'USD',
      order_field_name: 'IMEI or Serial Number ',
      price_usd: 0.031,
      product_id: '688',
      provider: 'petrock',
      synced_at: syncedAt.toISOString(),
      type: 'imei',
    });
  });

  it('rejects a catalog payload that lacks the documented products map', () => {
    expect(() => normalizePetrockCatalog({ data: {} }, new Date())).toThrow(
      'Petrock products response'
    );
  });

  it('rejects a non-USD catalog before prices reach money paths', () => {
    expect(() =>
      normalizePetrockCatalog(
        {
          data: {
            categories: {},
            currency: 'EUR',
            products: {
              '1955': {
                fields: [{ name: 'IMEI' }],
                name: 'Blacklist Check',
                price: 0.019,
                type: 'imei',
              },
            },
          },
        },
        new Date()
      )
    ).toThrow(/USD currency/i);
  });
});
