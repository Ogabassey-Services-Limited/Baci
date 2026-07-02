import type { CountryCode } from 'react-native-country-picker-modal';

interface GoogleAutocompletePrediction {
  description?: string;
  place_id?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

export interface GoogleAutocompleteResponse {
  predictions?: GoogleAutocompletePrediction[];
}

export interface AddressSuggestion {
  description: string;
  mainText: string;
  placeId: string;
  secondaryText: string;
}

export function buildGoogleAutocompleteUrl({
  googleMapsApiKey,
  input,
  selectedCountryCode,
}: {
  googleMapsApiKey: string;
  input: string;
  selectedCountryCode?: CountryCode;
}) {
  const params = new URLSearchParams({
    input,
    key: googleMapsApiKey,
    language: 'en',
  });

  if (selectedCountryCode) {
    params.set('components', `country:${selectedCountryCode.toLowerCase()}`);
  }

  return `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
}

export function toAddressSuggestions(
  response: GoogleAutocompleteResponse
): AddressSuggestion[] {
  return (response.predictions ?? [])
    .map((prediction, index) => {
      const description = prediction.description?.trim();
      if (!description) {
        return null;
      }

      return {
        description,
        mainText:
          prediction.structured_formatting?.main_text?.trim() ?? description,
        placeId: prediction.place_id ?? `${description}-${index}`,
        secondaryText:
          prediction.structured_formatting?.secondary_text?.trim() ?? '',
      };
    })
    .filter((suggestion): suggestion is AddressSuggestion =>
      Boolean(suggestion)
    )
    .slice(0, 5);
}
