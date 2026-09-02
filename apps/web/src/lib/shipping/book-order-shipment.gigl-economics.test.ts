import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  `${process.cwd()}/src/lib/shipping/book-order-shipment.ts`,
  'utf8'
);
describe('GIGL booking economics', () => {
  it('does not request or persist internal quote economics from an authenticated client', () => {
    const quoteSelect = source.match(
      /\.from\('shipping_quotes'\)[\s\S]*?\.select\(\s*'([^']+)'/
    )?.[1];

    expect(quoteSelect).toBeDefined();
    expect(quoteSelect).not.toMatch(
      /provider_cost|platform_margin|platform_margin_bps|pricing_version/
    );
    expect(source).not.toContain('provider_cost: resolvedQuote.provider_cost');
    expect(source).not.toContain(
      'platform_margin: resolvedQuote.platform_margin'
    );
  });

  it('keeps wallet funding fee handling on the server-side order/charge path', () => {
    expect(source).toContain("shipping_funding_source !== 'merchant_wallet'");
  });
});
