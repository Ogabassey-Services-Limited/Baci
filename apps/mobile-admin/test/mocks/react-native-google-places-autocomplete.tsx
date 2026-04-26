import { createElement } from 'react';

interface GooglePlacesAutocompleteProps {
  onPress?: (data: { description: string }, details?: unknown) => void;
  placeholder?: string;
  textInputProps?: {
    onChangeText?: (value: string) => void;
    value?: string;
  };
}

export function GooglePlacesAutocomplete({
  onPress,
  placeholder,
  textInputProps,
}: GooglePlacesAutocompleteProps) {
  return createElement('input', {
    'aria-label': placeholder ?? 'Search address',
    onChange: (event: { target: { value: string } }) =>
      textInputProps?.onChangeText?.(event.target.value),
    onClick: () => onPress?.({ description: textInputProps?.value ?? '' }),
    value: textInputProps?.value ?? '',
  });
}
