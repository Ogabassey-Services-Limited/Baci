import { describe, expect, it } from 'vitest';
import { filterByLocationPhrase } from './filter-by-location-phrase';

const locations = [
  { name: 'Ikeja Centre, Lagos' },
  { name: 'Badore Centre, Lekki' },
];

describe('filterByLocationPhrase', () => {
  it('returns exact phrase matches after normalizing punctuation and case', () => {
    expect(
      filterByLocationPhrase(
        locations,
        'IKEJA',
        'Lagos',
        (location) => location.name
      )
    ).toEqual([locations[0]]);
  });

  it('does not treat partial tokens as city matches', () => {
    expect(
      filterByLocationPhrase(
        locations,
        'Lek',
        'Lagos',
        (location) => location.name
      )
    ).toEqual(locations);
  });

  it('preserves all options when no city match exists', () => {
    expect(
      filterByLocationPhrase(
        locations,
        'Abuja',
        'FCT',
        (location) => location.name
      )
    ).toEqual(locations);
  });

  it('preserves all options when the city is empty', () => {
    const result = filterByLocationPhrase(
      locations,
      '',
      'Lagos',
      (location) => location.name
    );

    expect(result).toEqual(locations);
  });

  it('preserves all options when the city and state are the same', () => {
    const result = filterByLocationPhrase(
      locations,
      'Lagos',
      'Lagos',
      (location) => location.name
    );

    expect(result).toEqual(locations);
  });
});
