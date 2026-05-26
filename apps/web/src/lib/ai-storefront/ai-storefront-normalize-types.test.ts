import { describe, expect, it } from 'vitest';
import { defaultHeader } from './ai-storefront-normalize-defaults';
import {
  asRecord,
  bool,
  componentId,
  hexColor,
  integerInRange,
  parseComponent,
  pickLiteral,
  pickNumberLiteral,
  safeHref,
  text,
} from './ai-storefront-normalize-types';

describe('ai storefront normalize type helpers', () => {
  it('returns records only for non-array objects', () => {
    const record = { key: 'value' };

    expect(asRecord(record)).toBe(record);
    expect(asRecord(null)).toEqual({});
    expect(asRecord([])).toEqual({});
    expect(asRecord('value')).toEqual({});
  });

  it('uses booleans directly and falls back for non-booleans', () => {
    expect(bool(true, false)).toBe(true);
    expect(bool(false, true)).toBe(false);
    expect(bool('true', false)).toBe(false);
  });

  it('clamps integers to range and falls back for invalid numbers', () => {
    expect(integerInRange(5, 3, 1, 10)).toBe(5);
    expect(integerInRange(0, 3, 1, 10)).toBe(1);
    expect(integerInRange(15, 3, 1, 10)).toBe(10);
    expect(integerInRange(3.5, 3, 1, 10)).toBe(3);
    expect(integerInRange('5', 3, 1, 10)).toBe(3);
  });

  it('normalizes text by trimming, collapsing whitespace, and limiting length', () => {
    expect(text('  Premium\n phones   today  ', 15)).toBe('Premium phones');
    expect(text('  Premium\n phones   today  ', 8)).toBe('Premium');
    expect(text('   ', 20)).toBeUndefined();
    expect(text(null, 20)).toBeUndefined();
  });

  it('allows only internal or HTTPS hrefs', () => {
    expect(safeHref('/products')).toBe('/products');
    expect(safeHref('https://example.com/path')).toBe(
      'https://example.com/path'
    );
    expect(safeHref('//evil.com')).toBeUndefined();
    expect(safeHref('http://example.com')).toBeUndefined();
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
  });

  it('accepts strict six-digit hex colors only', () => {
    expect(hexColor('#1a2B3c')).toBe('#1a2B3c');
    expect(hexColor('blue')).toBeUndefined();
    expect(hexColor('#fff')).toBeUndefined();
  });

  it('picks string and number literals with fallbacks', () => {
    expect(pickLiteral('grid', ['grid', 'stack'] as const, 'stack')).toBe(
      'grid'
    );
    expect(pickLiteral('bad', ['grid', 'stack'] as const, 'stack')).toBe(
      'stack'
    );
    expect(pickNumberLiteral(4, [2, 3, 4] as const, 3)).toBe(4);
    expect(pickNumberLiteral(5, [2, 3, 4] as const, 3)).toBe(3);
  });

  it('builds component ids from valid text or fallback prefix and index', () => {
    expect(componentId(' hero-main ', 'hero', 0)).toBe('hero-main');
    expect(componentId('', 'hero', 2)).toBe('hero-3');
  });

  it('returns parsed components or the fallback when schema validation fails', () => {
    const fallback = defaultHeader();
    const valid = {
      type: 'ProductGrid' as const,
      props: { id: 'products', columns: 3, limit: 8 },
    };

    expect(parseComponent(valid, fallback)).toEqual(
      expect.objectContaining({ type: 'ProductGrid' })
    );
    expect(parseComponent({ type: 'Unknown', props: {} }, fallback)).toBe(
      fallback
    );
  });
});
