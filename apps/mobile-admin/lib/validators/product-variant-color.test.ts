import { describe, expect, it } from 'vitest';
import { readVariantColor } from './product-variant-color';

describe('readVariantColor', () => {
  it.each([
    [null, null],
    [undefined, null],
    [{}, null],
    [{ color: 'Black' }, 'Black'],
    [{ color: '  Black  ' }, 'Black'],
    [{ Color: 'Natural Titanium' }, 'Natural Titanium'],
    [{ colour: 'Blue' }, 'Blue'],
    [{ Colour: 'Green' }, 'Green'],
    [{ color: ' ', colour: 'Silver' }, 'Silver'],
    [{ color: 'Red', colour: 'Blue' }, 'Red'],
    [{ color: undefined }, null],
    [{ color: null }, null],
    [{ color: 123 }, null],
    [{ storage: '256GB' }, null],
  ] as const)('returns normalized variant color for %o', (attributes, color) => {
    expect(readVariantColor(attributes)).toBe(color);
  });
});
