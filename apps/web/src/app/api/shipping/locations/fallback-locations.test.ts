import { describe, expect, it } from 'vitest';
import {
  getFallbackCitiesForState,
  shouldUseFallbackCitiesForState,
} from './fallback-locations';

describe('fallback-locations', () => {
  it('resolves Abuja aliases to the FCT fallback city list', () => {
    expect(getFallbackCitiesForState('Abuja')).toEqual(
      expect.arrayContaining(['Garki', 'Wuse', 'Lugbe'])
    );
    expect(getFallbackCitiesForState('Federal Capital Territory')).toEqual(
      expect.arrayContaining(['Garki', 'Wuse', 'Lugbe'])
    );
  });

  it('uses fallback cities when provider returns a country-wide city dump', () => {
    const providerCities = Array.from({ length: 300 }, (_, index) => {
      return `City ${index}`;
    });

    expect(shouldUseFallbackCitiesForState(providerCities, 'Lagos')).toBe(true);
    expect(shouldUseFallbackCitiesForState(['Ikeja', 'Lekki'], 'Lagos')).toBe(
      false
    );
  });
});
