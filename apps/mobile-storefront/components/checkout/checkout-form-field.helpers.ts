import type { TextInputProps } from 'react-native';
import { type TextContentType, TextContentTypes } from '@/hooks/use-keyboard';
import type { ShippingAddressInput } from '@/lib/validation';

type TextInputAutoComplete = TextInputProps['autoComplete'];

export const CHECKOUT_FIELD_TEXT_CONTENT_TYPES: Partial<
  Record<keyof ShippingAddressInput, TextContentType>
> = {
  address: TextContentTypes.fullStreetAddress,
  city: TextContentTypes.addressCity,
  email: TextContentTypes.emailAddress,
  firstName: TextContentTypes.givenName,
  lastName: TextContentTypes.familyName,
  phone: TextContentTypes.telephoneNumber,
};

export const CHECKOUT_FIELD_AUTO_COMPLETE: Partial<
  Record<keyof ShippingAddressInput, TextInputAutoComplete>
> = {
  address: 'street-address',
  city: 'postal-address-locality',
  email: 'email',
  firstName: 'name-given',
  lastName: 'name-family',
  phone: 'tel',
};

export function humanizeCheckoutFieldName(
  field: keyof ShippingAddressInput | string
): string {
  switch (field) {
    case 'address':
      return 'delivery address';
    case 'city':
      return 'city';
    case 'email':
      return 'email address';
    case 'firstName':
      return 'first name';
    case 'lastName':
      return 'last name';
    case 'notes':
      return 'delivery notes';
    case 'phone':
      return 'phone number';
    case 'state':
      return 'state';
    default:
      return field;
  }
}
