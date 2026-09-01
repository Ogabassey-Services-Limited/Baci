import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  `${process.cwd()}/src/lib/shipping/book-order-shipment.ts`,
  'utf8'
);
describe('GIGL booking economics', () => {
  it('persists provider cost and margin and bypasses shopper fee equality for wallet funding', () => {
    expect(source).toContain('provider_cost: resolvedQuote.provider_cost');
    expect(source).toContain('platform_margin: resolvedQuote.platform_margin');
    expect(source).toContain("shipping_funding_source !== 'merchant_wallet'");
  });
});
