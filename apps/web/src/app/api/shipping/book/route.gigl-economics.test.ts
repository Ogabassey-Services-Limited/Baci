import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  `${process.cwd()}/src/app/api/shipping/book/route.ts`,
  'utf8'
);

describe('shipping booking quote projection', () => {
  it('does not request raw provider metadata from authenticated shipping_quotes', () => {
    const quoteSelect = source.match(
      /\.from\('shipping_quotes'\)[\s\S]*?\.select\(\s*'([^']+)'/
    )?.[1];

    expect(quoteSelect).toBeDefined();
    expect(quoteSelect).not.toContain('provider_metadata');
    expect(source).toContain('getShippingQuoteBookingMetadata');
  });
});
