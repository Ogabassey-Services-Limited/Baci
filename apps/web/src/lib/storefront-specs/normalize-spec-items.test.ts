import { describe, expect, it } from 'vitest';
import { normalizeSpecItems } from './normalize-spec-items';

describe('normalizeSpecItems', () => {
  it('normalizes scalar values and removes malformed spec rows', () => {
    expect(
      normalizeSpecItems([
        { label: ' Resolution ', value: ' <strong>1080p</strong> ' },
        { label: 'Numeric', value: 30 },
        { label: '', value: 'ignored' },
        null,
      ])
    ).toEqual([
      { label: 'Resolution', value: '1080p' },
      { label: 'Numeric', value: '30' },
    ]);
  });

  it('keeps the first value for duplicate canonical labels', () => {
    expect(
      normalizeSpecItems([
        { label: ' RAM ', value: '8GB' },
        { label: 'ram', value: '12GB' },
        { label: 'Internal Storage', value: '256GB' },
        { label: 'storage', value: '512GB' },
      ])
    ).toEqual([
      { label: 'RAM', value: '8GB' },
      { label: 'Internal Storage', value: '256GB' },
    ]);
  });
});
