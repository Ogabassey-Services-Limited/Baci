import { describe, expect, it } from 'vitest';
import {
  assertGoogleAutocompleteResponse,
  buildGoogleAutocompleteUrl,
  toAddressSuggestions,
} from './new-customer-address-autocomplete';

describe('new customer address autocomplete helpers', () => {
  it('builds a Google autocomplete URL scoped to the selected country', () => {
    expect(
      buildGoogleAutocompleteUrl({
        googleMapsApiKey: 'maps-key',
        input: '12 Allen Avenue',
        selectedCountryCode: 'GH',
      })
    ).toBe(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=12+Allen+Avenue&key=maps-key&language=en&components=country%3Agh'
    );
  });

  it('omits country scoping when no country code is selected', () => {
    expect(
      buildGoogleAutocompleteUrl({
        googleMapsApiKey: 'maps-key',
        input: '12 Allen Avenue',
      })
    ).toBe(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=12+Allen+Avenue&key=maps-key&language=en'
    );
  });

  it('trims predictions and falls back to a stable generated place id', () => {
    expect(
      toAddressSuggestions({
        predictions: [
          {
            description: ' 12 Allen Avenue, Ikeja ',
            structured_formatting: {
              main_text: ' 12 Allen Avenue ',
              secondary_text: ' Ikeja ',
            },
          },
          { description: '   ' },
        ],
      })
    ).toEqual([
      {
        description: '12 Allen Avenue, Ikeja',
        mainText: '12 Allen Avenue',
        placeId: '12 Allen Avenue, Ikeja-0',
        secondaryText: 'Ikeja',
      },
    ]);
  });

  it('caps suggestions at five rows', () => {
    expect(
      toAddressSuggestions({
        predictions: Array.from({ length: 7 }, (_, index) => ({
          description: `Address ${index + 1}`,
          place_id: `place-${index + 1}`,
        })),
      })
    ).toHaveLength(5);
  });

  it('allows successful and empty Google Places statuses', () => {
    expect(() =>
      assertGoogleAutocompleteResponse({ status: 'OK' })
    ).not.toThrow();
    expect(() =>
      assertGoogleAutocompleteResponse({ status: 'ZERO_RESULTS' })
    ).not.toThrow();
  });

  it('rejects Google Places API-level errors from successful HTTP responses', () => {
    expect(() =>
      assertGoogleAutocompleteResponse({
        error_message: 'The provided API key is invalid.',
        status: 'REQUEST_DENIED',
      })
    ).toThrow('The provided API key is invalid.');
  });

  it('falls back to a generic message when a Places error has no details', () => {
    expect(() =>
      assertGoogleAutocompleteResponse({ status: 'INVALID_REQUEST' })
    ).toThrow('Google Places returned INVALID_REQUEST');
  });
});
