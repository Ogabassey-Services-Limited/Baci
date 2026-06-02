import { describe, expect, it } from '@jest/globals';
import { CART_PRESS_FEEDBACK_STYLE } from './cart-press-feedback';

describe('CART_PRESS_FEEDBACK_STYLE', () => {
  it('uses a visible but non-disruptive pressed opacity', () => {
    expect(CART_PRESS_FEEDBACK_STYLE).toEqual({ opacity: 0.7 });
  });
});
