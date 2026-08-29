import { expect, it } from '@jest/globals';
import { isCheckoutAddressComplete } from './checkout-continue-readiness';

const completeAddress = {
  email: 'customer@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '08012345678',
  address: '12 Main Street',
  city: 'Katsina',
  state: 'Katsina',
};

it('keeps the address action unavailable until every required field is valid', () => {
  expect(isCheckoutAddressComplete(completeAddress)).toBe(true);
  expect(isCheckoutAddressComplete({ ...completeAddress, email: '' })).toBe(
    false
  );
  expect(isCheckoutAddressComplete({ ...completeAddress, address: 'No' })).toBe(
    false
  );
});
