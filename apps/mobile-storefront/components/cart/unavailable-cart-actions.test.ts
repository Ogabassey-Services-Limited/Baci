import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals';
import { unavailableCartActions } from './unavailable-cart-actions';

const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

afterEach(() => {
  consoleErrorSpy.mockClear();
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

describe('unavailableCartActions', () => {
  it('reports unavailable update quantity attempts', () => {
    unavailableCartActions.updateQuantity('cart-1', 2);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CartScreen] Attempted cart action while unavailable: updateQuantity(cart-1, 2)'
    );
  });

  it('reports unavailable removal attempts', () => {
    unavailableCartActions.removeItem('cart-1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CartScreen] Attempted cart action while unavailable: removeItem(cart-1)'
    );
  });

  it('reports unavailable clear cart attempts', () => {
    unavailableCartActions.clearCart();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CartScreen] Attempted cart action while unavailable: clearCart()'
    );
  });

  it('reports unavailable assurance toggle attempts', () => {
    unavailableCartActions.toggleAssurance('cart-1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CartScreen] Attempted cart action while unavailable: toggleAssurance(cart-1)'
    );
  });
});
