import { describe, expect, it } from 'vitest';
import { buildDescriptionKeySpecs } from './build-description-key-specs';

describe('buildDescriptionKeySpecs', () => {
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

  it('extracts a key-spec table when the table tag is uppercase', () => {
    expect(
      buildDescriptionKeySpecs(
        '<h2>Key Specs</h2><TABLE><TR><TH>Display</TH><TD>6.8 inches</TD></TR></TABLE>'
      )
    ).toEqual([
      {
        category: 'Key Specs',
        items: [{ label: 'Display', value: '6.8 inches' }],
      },
    ]);
  });

  it('ignores descriptions without a complete table', () => {
    expect(buildDescriptionKeySpecs('<p>No key table</p>')).toEqual([]);
    expect(
      buildDescriptionKeySpecs(
        '<h2>Key Specs</h2><table><tr><td>Display</td></tr></table>'
      )
    ).toEqual([]);
  });
});
