import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { CartItem } from '@/stores/cart-store';
import NegotiationButton from './NegotiationButton';

function createItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'cart-1',
    product_id: 'product-1',
    slug: 'iphone-13-pro',
    name: 'iPhone 13 Pro',
    price: 500000,
    quantity: 1,
    ...overrides,
  };
}

describe('NegotiationButton', () => {
  it('renders matched badge when negotiation is accepted', () => {
    const item = createItem({ negotiationStatus: 'accepted' });
    const openItemNegotiationMock = jest.fn();

    render(
      <NegotiationButton
        item={item}
        openItemNegotiation={openItemNegotiationMock}
        colors={Colors.light}
        negotiateSurface="#fff"
        negotiateBorder="#f00"
      />
    );

    expect(screen.getByText('Matched')).toBeTruthy();
    expect(screen.queryByText('Negotiate')).toBeNull();
    expect(openItemNegotiationMock).not.toHaveBeenCalled();
  });

  it('renders negotiate button and calls handler when pressed', () => {
    const item = createItem({ negotiationStatus: undefined });
    const openItemNegotiation = jest.fn();

    render(
      <NegotiationButton
        item={item}
        openItemNegotiation={openItemNegotiation}
        colors={Colors.light}
        negotiateSurface="#fff"
        negotiateBorder="#f00"
      />
    );

    fireEvent.press(screen.getByText('Negotiate'));
    expect(openItemNegotiation).toHaveBeenCalledWith(item);
  });

  it('shows best-price instead of stale matched state for non-negotiable accepted items', () => {
    const item = createItem({
      brand: 'Tecno',
      name: 'Tecno Spark 50',
      negotiatedPrice: 147000,
      negotiationStatus: 'accepted',
    });

    render(
      <NegotiationButton
        item={item}
        openItemNegotiation={jest.fn()}
        colors={Colors.light}
        negotiateSurface="#fff"
        negotiateBorder="#f00"
      />
    );

    expect(screen.getByText('Best price')).toBeTruthy();
    expect(screen.queryByText('Matched')).toBeNull();
  });

  it('shows a best-price badge and does not negotiate non-negotiable items', () => {
    const item = createItem({ brand: 'Tecno', name: 'Tecno Spark 50' });
    const openItemNegotiation = jest.fn();

    render(
      <NegotiationButton
        item={item}
        openItemNegotiation={openItemNegotiation}
        colors={Colors.light}
        negotiateSurface="#fff"
        negotiateBorder="#f00"
      />
    );

    const badge = screen.getByLabelText('Best price for Tecno Spark 50');
    expect(badge).toBeTruthy();
    expect(screen.getByText('Best price')).toBeTruthy();
    expect(screen.queryByText('Negotiate')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(openItemNegotiation).not.toHaveBeenCalled();
  });
});
