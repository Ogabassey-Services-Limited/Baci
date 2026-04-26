import { createElement } from 'react';

interface GooglePlacesAutocompleteProps {
  onPress?: (data: { description: string }, details?: unknown) => void;
  placeholder?: string;
  textInputProps?: {
    onChangeText?: (value: string) => void;
    value?: string;
  };
}

function createMockPlaceDetails(description: string) {
  return {
    address_components: [
      {
        long_name: 'Ikeja',
        short_name: 'Ikeja',
        types: ['locality'],
      },
      {
        long_name: 'Lagos',
        short_name: 'LA',
        types: ['administrative_area_level_1'],
      },
    ],
    formatted_address: description,
  };
}

export function GooglePlacesAutocomplete({
  onPress,
  placeholder,
  textInputProps,
}: GooglePlacesAutocompleteProps) {
  const value = textInputProps?.value ?? '';

  return createElement('div', null, [
    createElement('input', {
      key: 'input',
      'aria-label': placeholder ?? 'Search Address',
      onChange: (event: { target: { value: string } }) =>
        textInputProps?.onChangeText?.(event.target.value),
      value,
    }),
    createElement(
      'button',
      {
        key: 'select',
        type: 'button',
        'aria-label': 'Choose suggested address',
        onClick: () =>
          onPress?.({ description: value }, createMockPlaceDetails(value)),
      },
      'Choose suggested address'
    ),
  ]);
}
