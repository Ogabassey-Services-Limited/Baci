import { describe, expect, it } from 'vitest';
import { parseSantaAction, stripSantaActions } from './parse-santa-action';

describe('parseSantaAction', () => {
  it('parses a directive with a plain integer price', () => {
    const result = parseSantaAction(
      'Granted! ACTION:ADD_TO_CART|PRODUCT:iPhone 15|PRICE:850000'
    );
    expect(result).toEqual({
      type: 'ADD_TO_CART',
      productName: 'iPhone 15',
      price: 850000,
    });
  });

  it('parses a price with thousands separators', () => {
    const result = parseSantaAction(
      'ACTION:ADD_TO_CART|PRODUCT:Samsung Galaxy S24|PRICE:1,200,000'
    );
    expect(result).toEqual({
      type: 'ADD_TO_CART',
      productName: 'Samsung Galaxy S24',
      price: 1200000,
    });
  });

  it('trims surrounding whitespace from the product name', () => {
    const result = parseSantaAction(
      'ACTION:ADD_TO_CART|PRODUCT:  MacBook Air  |PRICE:999000'
    );
    expect(result?.productName).toBe('MacBook Air');
  });

  it('returns null when there is no directive', () => {
    expect(parseSantaAction('Hello Santa!')).toBeNull();
    expect(parseSantaAction('')).toBeNull();
  });

  it('returns null when the PRICE component is missing', () => {
    expect(
      parseSantaAction('ACTION:ADD_TO_CART|PRODUCT:Samsung Galaxy S24')
    ).toBeNull();
  });
});

describe('stripSantaActions', () => {
  it('removes the directive and trims the remaining message', () => {
    const stripped = stripSantaActions(
      'Your wish is granted! ACTION:ADD_TO_CART|PRODUCT:iPhone 15|PRICE:850,000'
    );
    expect(stripped).toBe('Your wish is granted!');
  });

  it('removes every directive when more than one is present', () => {
    const stripped = stripSantaActions(
      'ACTION:ADD_TO_CART|PRODUCT:A|PRICE:1000 and ACTION:ADD_TO_CART|PRODUCT:B|PRICE:2000'
    );
    expect(stripped).toBe('and');
  });

  it('leaves text without a directive unchanged', () => {
    expect(stripSantaActions('Just a friendly reply')).toBe(
      'Just a friendly reply'
    );
  });
});
