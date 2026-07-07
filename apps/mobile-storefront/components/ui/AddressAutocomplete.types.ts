import type { TextInputProps, ViewStyle } from 'react-native';

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

export interface PlaceDetails {
  streetNumber: string;
  route: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  formattedAddress: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressAutocompleteProps
  extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value?: string;
  onChangeText?: (value: string) => void;
  onSelect?: (place: PlaceDetails) => void;
  containerStyle?: ViewStyle;
  error?: string;
  label?: string;
  country?: string;
}
