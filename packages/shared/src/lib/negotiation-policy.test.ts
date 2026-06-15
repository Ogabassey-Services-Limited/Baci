import { describe, expect, it } from 'vitest';
import {
  COUNTER_NEGOTIATION_DISCOUNT_STEPS,
  isProductNegotiable,
  MAX_AUTO_NEGOTIATION_DISCOUNT_RATE,
} from './negotiation-policy';

describe('negotiation policy', () => {
  it('uses a 2% automatic negotiation cap', () => {
    expect(MAX_AUTO_NEGOTIATION_DISCOUNT_RATE).toBe(0.02);
    expect(COUNTER_NEGOTIATION_DISCOUNT_STEPS).toEqual([0.01, 0.015, 0.02]);
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
});
