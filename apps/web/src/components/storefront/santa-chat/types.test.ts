import { describe, expect, it } from 'vitest';
import { parseSantaAction, parseSantaActions } from './types';

describe('parseSantaAction', () => {
  it('extracts product name and numeric price from valid action string', () => {
    const result = parseSantaAction(
      'ACTION:ADD_TO_CART|PRODUCT:Samsung Galaxy S24|PRICE:450000'
    );

    expect(result).toEqual({
      type: 'ADD_TO_CART',
      productName: 'Samsung Galaxy S24',
      price: 450000,
    });
  });

  it('handles comma-separated prices', () => {
    const result = parseSantaAction(
      'ACTION:ADD_TO_CART|PRODUCT:MacBook Pro|PRICE:1,200,000'
    );

    expect(result).toEqual({
      type: 'ADD_TO_CART',
      productName: 'MacBook Pro',
      price: 1200000,
    });
  });

  it('handles a single comma group in price', () => {
    const result = parseSantaAction(
      'ACTION:ADD_TO_CART|PRODUCT:AirPods|PRICE:1,200'
    );

    expect(result).toEqual({
      type: 'ADD_TO_CART',
      productName: 'AirPods',
      price: 1200,
    });
  });

  it('returns null when no action pattern is found', () => {
    expect(parseSantaAction('Hello Santa!')).toBeNull();
    expect(parseSantaAction('')).toBeNull();
  });

  it('returns null for partial patterns missing PRICE', () => {
    expect(
      parseSantaAction('ACTION:ADD_TO_CART|PRODUCT:Samsung Galaxy S24')
    ).toBeNull();
  });

  it('trims whitespace from product name', () => {
    const result = parseSantaAction(
      'ACTION:ADD_TO_CART|PRODUCT:  iPhone 16 Pro  |PRICE:899000'
    );

    expect(result).toEqual({
      type: 'ADD_TO_CART',
      productName: 'iPhone 16 Pro',
      price: 899000,
    });
  });
});

describe('parseSantaActions', () => {
  it('extracts multiple actions from one assistant response', () => {
    expect(
      parseSantaActions(
        'ACTION:ADD_TO_CART|PRODUCT:Phone|PRICE:450000 ACTION:ADD_TO_CART|PRODUCT:Case|PRICE:12,000'
      )
    ).toEqual([
      { type: 'ADD_TO_CART', productName: 'Phone', price: 450000 },
      { type: 'ADD_TO_CART', productName: 'Case', price: 12000 },
    ]);
  });
});
