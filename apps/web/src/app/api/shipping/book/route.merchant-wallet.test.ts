import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  `${process.cwd()}/src/app/api/shipping/book/route.ts`,
  'utf8'
);
describe('direct shipping booking merchant wallet guard', () => {
  it('fails closed and delegates wallet orders to the order workflow', () => {
    expect(source).toContain(
      "order.shipping_funding_source === 'merchant_wallet'"
    );
    expect(source).toContain('USE_ORDER_SHIPMENT_BOOKING');
  });
});
