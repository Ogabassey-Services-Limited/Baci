import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  `${process.cwd()}/src/app/api/orders/[id]/route.ts`,
  'utf8'
);
describe('order PATCH merchant wallet booking', () => {
  it('uses the wallet-funded orchestration wrapper', () => {
    expect(source).toContain('bookWalletOrCustomerCheckout');
    expect(source).toContain('existingOrder.shipping_funding_source');
  });

  it('passes the requested payment status into prepaid GIGL booking', () => {
    expect(source).toContain('payment_status ?? existingOrder.payment_status');
  });
});
