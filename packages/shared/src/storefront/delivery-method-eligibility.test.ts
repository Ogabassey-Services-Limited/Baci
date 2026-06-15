import { describe, expect, it } from 'vitest';
import {
  isAirportDeliveryEligible,
  isPickupEligible,
} from './delivery-method-eligibility';

describe('isPickupEligible', () => {
  it('is true only for Lagos (case/space-insensitive)', () => {
    expect(isPickupEligible('Lagos')).toBe(true);
    expect(isPickupEligible('  lagos ')).toBe(true);
    expect(isPickupEligible('LAGOS')).toBe(true);
  });

  it('is false for other states and when no state is set', () => {
    expect(isPickupEligible('Oyo')).toBe(false);
    expect(isPickupEligible('Abuja')).toBe(false);
    expect(isPickupEligible('')).toBe(false);
    expect(isPickupEligible(undefined)).toBe(false);
    expect(isPickupEligible(null)).toBe(false);
  });
});

describe('isAirportDeliveryEligible', () => {
  it('is true for a non-Lagos state that has an airport', () => {
    expect(isAirportDeliveryEligible('Rivers')).toBe(true);
    expect(isAirportDeliveryEligible('kano')).toBe(true);
    expect(isAirportDeliveryEligible('Abuja')).toBe(true);
    expect(isAirportDeliveryEligible('FCT')).toBe(true);
    expect(isAirportDeliveryEligible('Federal Capital Territory')).toBe(true);
    expect(isAirportDeliveryEligible('FCT - Abuja')).toBe(true);
  });

  it('is false for Lagos even though the store ships from there', () => {
    expect(isAirportDeliveryEligible('Lagos')).toBe(false);
    expect(isAirportDeliveryEligible('lagos')).toBe(false);
  });

  it('is false for a state without an airport and when no state is set', () => {
    expect(isAirportDeliveryEligible('Ekiti')).toBe(false);
    expect(isAirportDeliveryEligible('Ogun')).toBe(false);
    expect(isAirportDeliveryEligible('')).toBe(false);
    expect(isAirportDeliveryEligible(undefined)).toBe(false);
    expect(isAirportDeliveryEligible(null)).toBe(false);
  });
});
