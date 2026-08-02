import { describe, expect, it } from 'vitest';
import { analyzeSEO } from './seo-analysis';

describe('analyzeSEO', () => {
  it('does not treat an empty focus keyword as present in the title or description', () => {
    const result = analyzeSEO(
      'Premium leather tote bag for everyday shopping',
      'Shop this premium leather tote bag with reliable delivery across Nigeria and elegant everyday storage for work, errands, and weekend travel.',
      ['leather tote', 'bags nigeria', 'premium bag'],
      ''
    );

    expect(result.title_has_keyword).toBe(false);
    expect(result.description_has_keyword).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'Focus keyword not found in title',
        'Focus keyword not found in description',
      ])
    );
  });
});
