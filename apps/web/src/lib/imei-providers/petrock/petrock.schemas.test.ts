import { describe, expect, it } from 'vitest';
import {
  petrockAccountResponseSchema,
  petrockOrderResponseSchema,
  petrockProductsResponseSchema,
  petrockSubmitOrderResponseSchema,
} from './petrock.schemas';

describe('Petrock response schemas', () => {
  it('parses reseller balance as operational account data', () => {
    expect(
      petrockAccountResponseSchema.parse({
        data: { balance: '24.7500', currency: 'USD' },
      }).data
    ).toEqual({ balance: 24.75, currency: 'USD' });
  });

  it('extracts the synchronously returned nested order UUID', () => {
    const parsed = petrockSubmitOrderResponseSchema.parse({
      data: [[{ order_uuid: 'order-123', reference_id: 'lookup-123' }]],
      success: true,
    });

    expect(parsed.data[0][0]).toMatchObject({
      order_uuid: 'order-123',
      reference_id: 'lookup-123',
    });
  });

  it('accepts every empirically observed order status', () => {
    for (const status of ['new', 'in-process', 'success', 'reject'] as const) {
      expect(
        petrockOrderResponseSchema.parse({
          data: { order_uuid: 'order-123', replay: 'Model: iPhone', status },
        }).data.status
      ).toBe(status);
    }
  });

  it('preserves byte-exact product field names', () => {
    const parsed = petrockProductsResponseSchema.parse({
      data: {
        categories: { C164: { name: 'IMEI checks' } },
        currency: 'USD',
        products: {
          '688': {
            cids: ['C164'],
            fields: [{ name: 'IMEI or Serial Number ', required: true }],
            name: 'Apple Full Check',
            price: '0.031',
            type: 'imei',
          },
        },
      },
    });

    expect(parsed.data.products['688']?.fields[0]?.name).toBe(
      'IMEI or Serial Number '
    );
  });
});
