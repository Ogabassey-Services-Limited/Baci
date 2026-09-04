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

  it('loads retained shipping via booking economics instead of revoked order columns', () => {
    expect(source).toContain('getShippingQuoteBookingEconomics');
    expect(source).toContain(
      'bookingEconomics?.shipping_platform_retained_amount'
    );
    expect(source).toContain('isFundedCheckoutGiglAddressLocked');
    expect(source).toContain('settled retention only');
    expect(source).not.toContain(
      'existingOrder.shipping_platform_retained_amount'
    );
    expect(source).not.toMatch(
      /\.select\(\s*'[^']*shipping_platform_retained_amount[^']*'\s*\)/
    );
  });
});
