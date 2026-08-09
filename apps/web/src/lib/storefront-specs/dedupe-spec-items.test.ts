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
});
