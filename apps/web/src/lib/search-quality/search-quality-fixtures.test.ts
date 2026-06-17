import { describe, expect, it } from 'vitest';
import { SEARCH_QUALITY_FIXTURES } from './search-quality-fixtures';

describe('SEARCH_QUALITY_FIXTURES', () => {
  it('covers the required search quality classes', () => {
    const classes = new Set(
      SEARCH_QUALITY_FIXTURES.map((fixture) => fixture.kind)
    );

    expect(classes).toEqual(
      new Set([
        'exact',
        'typo',
        'spec',
        'condition',
        'price-intent',
        'locale',
        'agentic-parity',
        'zero-results',
      ])
    );
  });

  it('keeps typo and price-intent fixtures actionable', () => {
    expect(
      SEARCH_QUALITY_FIXTURES.some(
        (fixture) =>
          fixture.query === 'iphnoe' &&
          fixture.expectedTopProductNames.includes('iPhone')
      )
    ).toBe(true);

    expect(
      SEARCH_QUALITY_FIXTURES.some(
        (fixture) =>
          fixture.kind === 'price-intent' &&
          fixture.expectedParsedFilters?.maxPrice === 500000
      )
    ).toBe(true);
  });

  it('keeps condition fixtures canonical', () => {
    expect(
      SEARCH_QUALITY_FIXTURES.some(
        (fixture) =>
          fixture.query === 'used iphone' &&
          fixture.expectedParsedFilters?.condition === 'used'
      )
    ).toBe(true);

    expect(
      SEARCH_QUALITY_FIXTURES.some(
        (fixture) =>
          fixture.query === 'refurbished iphone' &&
          fixture.expectedParsedFilters?.condition === 'open_box'
      )
    ).toBe(true);
  });
});
