import { describe, expect, it } from 'vitest';
import { CARRIER_PROVIDER_IDS } from './shipping-providers';

describe('CARRIER_PROVIDER_IDS', () => {
  it('keeps the live merchant carrier catalog stable', () => {
    expect(CARRIER_PROVIDER_IDS).toEqual(['gigl', 'topship']);
  });
});
