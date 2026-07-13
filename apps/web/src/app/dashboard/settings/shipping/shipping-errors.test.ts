import { describe, expect, it } from 'vitest';
import {
  RestOfWorldZoneDeleteError,
  RestOfWorldZoneLocationsError,
  ShippingRateNotFoundError,
  ShippingZoneNotFoundError,
} from './shipping-errors';

describe('RestOfWorldZoneDeleteError', () => {
  it('is an Error with a fixed, user-facing message and name', () => {
    const error = new RestOfWorldZoneDeleteError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RestOfWorldZoneDeleteError');
    expect(error.message).toBe(
      'The "Everywhere else" zone is your delivery fallback and cannot be deleted.'
    );
  });
});

describe('RestOfWorldZoneLocationsError', () => {
  it('is an Error with a fixed, user-facing message and name', () => {
    const error = new RestOfWorldZoneLocationsError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RestOfWorldZoneLocationsError');
    expect(error.message).toBe(
      'The "Everywhere else" zone matches any destination and cannot have specific locations assigned to it.'
    );
  });
});

describe('ShippingZoneNotFoundError', () => {
  it('is an Error with a fixed message and name', () => {
    const error = new ShippingZoneNotFoundError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ShippingZoneNotFoundError');
    expect(error.message).toBe('Zone not found');
  });
});

describe('ShippingRateNotFoundError', () => {
  it('is an Error with a fixed message and name distinct from the zone error', () => {
    const error = new ShippingRateNotFoundError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ShippingRateNotFoundError');
    expect(error.message).toBe('Rate not found');
  });
});
