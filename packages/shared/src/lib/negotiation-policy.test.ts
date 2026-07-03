import { describe, expect, it } from 'vitest';
import {
  COUNTER_NEGOTIATION_DISCOUNT_STEPS,
  computeNegotiationCounterOffer,
  isProductNegotiable,
  MAX_AUTO_NEGOTIATION_DISCOUNT_RATE,
} from './negotiation-policy';

describe('negotiation policy', () => {
  it('uses a 2% automatic negotiation cap', () => {
    expect(MAX_AUTO_NEGOTIATION_DISCOUNT_RATE).toBe(0.02);
    expect(COUNTER_NEGOTIATION_DISCOUNT_STEPS).toEqual([0.01, 0.015, 0.02]);
  });

  it('computes capped counter offers with backend rounding rules', () => {
    expect(computeNegotiationCounterOffer(10_000, 0.01)).toBe(9900);
    expect(computeNegotiationCounterOffer(999, 0.02)).toBe(980);
    expect(computeNegotiationCounterOffer(1001, 0.02)).toBe(980);
    expect(computeNegotiationCounterOffer(1048.95, 0.02)).toBe(1028.95);
    expect(computeNegotiationCounterOffer(1001, 0.02, 0.075)).toBe(981);
  });

  it.each([
    ['Infinix', 'Infinix Hot 50'],
    ['Tecno', 'Spark 20'],
    ['Vivo', 'Y28'],
    ['Redmi', 'Redmi Note 13'],
    ['Xiaomi', 'Xiaomi 14T'],
    ['Oppo', 'Oppo A58'],
    ['Itel', 'Itel S24'],
    ['Honor', 'Honor X8b'],
  ])('marks %s products as non-negotiable', (brand, name) => {
    expect(isProductNegotiable({ brand, name })).toBe(false);
  });

  it.each([
    ['Samsung', 'Samsung Galaxy A16 5G'],
    ['Samsung', 'Galaxy A55'],
    ['Samsung', 'Samsung Galaxy A Series'],
    ['Samsung', 'Samsung A Series'],
    [undefined, 'Samsung A05s'],
  ])('marks Samsung A-series products as non-negotiable', (brand, name) => {
    expect(isProductNegotiable({ brand, name })).toBe(false);
  });

  it.each([
    ['Samsung', 'Samsung Galaxy S25 Ultra'],
    ['Samsung', 'Samsung Galaxy Z Fold6'],
    ['Apple', 'iPhone 15 Pro Max A2890'],
    [undefined, 'MacBook Air M1'],
  ])('keeps non-budget products negotiable', (brand, name) => {
    expect(isProductNegotiable({ brand, name })).toBe(true);
  });

  it('returns true for empty/null/undefined inputs', () => {
    expect(isProductNegotiable({ brand: null, name: null })).toBe(true);
    expect(isProductNegotiable({ brand: '', name: '' })).toBe(true);
    expect(isProductNegotiable({ brand: undefined, name: undefined })).toBe(
      true
    );
  });

  it('normalizes special characters when matching budget brands', () => {
    expect(isProductNegotiable({ brand: 'OPPO', name: 'A-58' })).toBe(false);
    expect(
      isProductNegotiable({ brand: 'Samsung', name: 'Galaxy A16-5G' })
    ).toBe(false);
  });
});
