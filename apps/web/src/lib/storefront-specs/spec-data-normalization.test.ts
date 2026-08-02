import { describe, expect, it } from 'vitest';
import {
  buildDescriptionKeySpecs,
  normalizeSpecSections,
} from './spec-data-normalization';

describe('spec data normalization', () => {
  it('normalizes scalar values and removes malformed spec rows', () => {
    expect(
      normalizeSpecSections([
        {
          category: ' Display ',
          items: [
            { label: ' Resolution ', value: ' <strong>1080p</strong> ' },
            { label: 'Numeric', value: 30 },
            { label: '', value: 'ignored' },
          ],
        },
      ])
    ).toEqual([
      {
        category: 'Display',
        items: [
          { label: 'Resolution', value: '1080p' },
          { label: 'Numeric', value: '30' },
        ],
      },
    ]);
  });

  it('extracts a key-spec table from the product description', () => {
    expect(
      buildDescriptionKeySpecs(
        '<h2>Key Specs</h2><table><tr><th>Display</th><td>6.8 inches</td></tr></table>'
      )
    ).toEqual([
      {
        category: 'Key Specs',
        items: [{ label: 'Display', value: '6.8 inches' }],
      },
    ]);
  });
});
