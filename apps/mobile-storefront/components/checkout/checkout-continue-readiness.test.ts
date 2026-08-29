import { expect, it } from '@jest/globals';
import {
  isCheckoutAddressComplete,
  isCheckoutAddressContinueReady,
} from './checkout-continue-readiness';

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

it('enables Continue when a required road quote is selected and current', () => {
  expect(
    isCheckoutAddressContinueReady({
      hasFreshShippingQuote: true,
      isAddressComplete: true,
      isLoadingQuotes: false,
      requiresShippingQuote: true,
    })
  ).toBe(true);
});

it('keeps Continue available for free merchant pickup while provider quotes load', () => {
  expect(
    isCheckoutAddressContinueReady({
      hasFreshShippingQuote: false,
      isAddressComplete: true,
      isLoadingQuotes: true,
      requiresShippingQuote: false,
    })
  ).toBe(true);
});

it('keeps Continue disabled while a required quote is loading or missing', () => {
  const baseState = {
    hasFreshShippingQuote: false,
    isAddressComplete: true,
    requiresShippingQuote: true,
  };

  expect(
    isCheckoutAddressContinueReady({
      ...baseState,
      isLoadingQuotes: true,
    })
  ).toBe(false);
  expect(
    isCheckoutAddressContinueReady({
      ...baseState,
      isLoadingQuotes: false,
    })
  ).toBe(false);
});
