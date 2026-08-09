import { describe, expect, it } from 'vitest';
import { mergeSpecSections } from './merge-spec-sections';

describe('mergeSpecSections', () => {
  it('keeps same-label facts in separate sections while stored values win ties', () => {
    expect(
      mergeSpecSections(
        [
          {
            category: 'Display',
            items: [{ label: 'Protection', value: 'Gorilla Glass Victus 2' }],
          },
          {
            category: 'Body',
            items: [{ label: 'Protection', value: 'IP68' }],
          },
        ],
        [
          {
            category: 'Display',
            items: [{ label: 'Protection', value: 'Ceramic Shield' }],
          },
          {
            category: 'Body',
            items: [{ label: 'Protection', value: 'IP69' }],
          },
        ]
      )
    ).toEqual([
      {
        category: 'Display',
        items: [{ label: 'Protection', value: 'Gorilla Glass Victus 2' }],
      },
      {
        category: 'Body',
        items: [{ label: 'Protection', value: 'IP68' }],
      },
    ]);
  });

  it('does not repeat stored fields from a generic derived section', () => {
    expect(
      mergeSpecSections(
        [{ category: 'Memory', items: [{ label: 'RAM', value: '8GB' }] }],
        [
          {
            category: 'Key Specs',
            items: [
              { label: 'ram', value: '16GB' },
              { label: 'Camera', value: '50MP' },
            ],
          },
        ]
      )
    ).toEqual([
      { category: 'Memory', items: [{ label: 'RAM', value: '8GB' }] },
      { category: 'Key Specs', items: [{ label: 'Camera', value: '50MP' }] },
    ]);
  });

  it('retains a unique generic fact when stored sections have legitimate same-label facts', () => {
    expect(
      mergeSpecSections(
        [
          {
            category: 'Display',
            items: [{ label: 'Protection', value: 'Gorilla Glass' }],
          },
          {
            category: 'Body',
            items: [{ label: 'Protection', value: 'IP68' }],
          },
        ],
        [
          {
            category: 'Key Specs',
            items: [{ label: 'Camera', value: '50MP' }],
          },
        ]
      )
    ).toEqual([
      {
        category: 'Display',
        items: [{ label: 'Protection', value: 'Gorilla Glass' }],
      },
      {
        category: 'Body',
        items: [{ label: 'Protection', value: 'IP68' }],
      },
      {
        category: 'Key Specs',
        items: [{ label: 'Camera', value: '50MP' }],
      },
    ]);
  });
});
