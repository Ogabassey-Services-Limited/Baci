import { TextContentTypes } from '@/hooks/use-keyboard';
import {
  CHECKOUT_FIELD_AUTO_COMPLETE,
  CHECKOUT_FIELD_TEXT_CONTENT_TYPES,
  humanizeCheckoutFieldName,
} from './checkout-form-field.helpers';

describe('checkout-form-field.helpers', () => {
  it.each([
    ['firstName', 'first name'],
    ['lastName', 'last name'],
    ['phone', 'phone number'],
    ['email', 'email address'],
    ['address', 'delivery address'],
    ['city', 'city'],
    ['state', 'state'],
    ['notes', 'delivery notes'],
  ] as const)('humanizes %s', (field, expected) => {
    expect(humanizeCheckoutFieldName(field)).toBe(expected);
  });

  it('returns the raw field name for unknown fields', () => {
    expect(humanizeCheckoutFieldName('unknown_field')).toBe('unknown_field');
  });

  it('maps shipping address fields to native text content types', () => {
    expect(CHECKOUT_FIELD_TEXT_CONTENT_TYPES).toMatchObject({
      email: TextContentTypes.emailAddress,
      firstName: TextContentTypes.givenName,
      lastName: TextContentTypes.familyName,
      phone: TextContentTypes.telephoneNumber,
      address: TextContentTypes.fullStreetAddress,
      city: TextContentTypes.addressCity,
    });
  });

  it('maps shipping address fields to autocomplete hints', () => {
    expect(CHECKOUT_FIELD_AUTO_COMPLETE).toMatchObject({
      email: 'email',
      firstName: 'name-given',
      lastName: 'name-family',
      phone: 'tel',
      address: 'street-address',
      city: 'postal-address-locality',
    });
  });
});
