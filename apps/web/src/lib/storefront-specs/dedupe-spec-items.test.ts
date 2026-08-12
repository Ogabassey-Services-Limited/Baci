import { describe, expect, it } from 'vitest';
import { dedupeSpecItems } from './dedupe-spec-items';

describe('dedupeSpecItems', () => {
  it('retains the first supported canonical label value', () => {
    expect(
      dedupeSpecItems(
        [
          { label: 'RAM', value: '0GB' },
          { label: 'ram', value: '8GB' },
          { label: 'Internal Storage', value: '256GB' },
          { label: 'storage', value: '512GB' },
        ],
        { omitUnsupportedValues: true }
      )
    ).toEqual([
      { label: 'ram', value: '8GB' },
      { label: 'Internal Storage', value: '256GB' },
    ]);
  });

  it('keeps distinct non-Latin labels when canonicalization is empty', () => {
    expect(
      dedupeSpecItems([
        { label: '重量', value: '450g' },
        { label: '尺寸', value: '120 x 70 x 35 mm' },
      ])
    ).toEqual([
      { label: '重量', value: '450g' },
      { label: '尺寸', value: '120 x 70 x 35 mm' },
    ]);
  });
});
