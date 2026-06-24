import { describe, expect, it } from 'vitest';
import { parsePriceInput } from './product-currency-input';

describe('product currency input parsing', () => {
  it('parses locale decimal commas', () => {
    expect(parsePriceInput('1.234,56', 'pt-BR')).toBe(1234.56);
  });

  it('accepts decimal dots in comma-decimal locales when no comma is present', () => {
    expect(parsePriceInput('9.99', 'pt-BR')).toBe(9.99);
    expect(parsePriceInput('1234.56', 'de-DE')).toBe(1234.56);
  });

  it('accepts pasted US-formatted prices in comma-decimal locales', () => {
    expect(parsePriceInput('1,234.56', 'pt-BR')).toBe(1234.56);
    expect(parsePriceInput('$12,345.67', 'de-DE')).toBe(12345.67);
  });

  it('keeps single three-digit dots as grouping separators in comma-decimal locales', () => {
    expect(parsePriceInput('1.234', 'pt-BR')).toBe(1234);
  });
});
