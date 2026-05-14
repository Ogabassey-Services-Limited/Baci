import { describe, expect, it } from 'vitest';
import { makeOrder } from './order-export.test-helpers';
import { buildOrdersCsv } from './buildOrdersCsv';

describe('buildOrdersCsv', () => {
  it('builds a CSV with the expected order columns', () => {
    const csv = buildOrdersCsv([
      makeOrder({
        customer_name: 'Grace Hopper',
        order_number: 'BAC-777',
        total: 22000,
      }),
    ]);

    const lines = csv.split('\n');

    expect(lines[0]).toBe(
      'Order Number,Customer Name,Customer Email,Customer Phone,Date,Status,Payment Status,Total,Items,Address,City,State'
    );
    expect(lines[1]).toContain('BAC-777');
    expect(lines[1]).toContain('Grace Hopper');
    expect(lines[1]).toContain('22000');
  });

  it('escapes CSV formulas, commas, quotes, and newlines', () => {
    const csv = buildOrdersCsv([
      makeOrder({
        customer_name: '=SUM(A1:A2)',
        notes: '"rush"',
        shipping_address: {
          address_line1: 'Line 1,\nLine 2',
          city: 'Lagos',
          state: 'Lagos',
        },
      }),
    ]);

    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain('"Line 1,\nLine 2"');
  });
});
