import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { CartPriceChange } from '@/services/cart-reprice';
import PriceChangeModal from './PriceChangeModal';

const priceChanges: CartPriceChange[] = [
  {
    id: 'cart-1',
    name: 'iPhone 15 Pro',
    oldPrice: 1200000,
    newPrice: 1250000,
  },
  {
    id: 'cart-2',
    name: 'Samsung Galaxy S25',
    oldPrice: 980000,
    newPrice: 970000,
  },
];

describe('PriceChangeModal', () => {
  it('renders updated line prices for every changed cart item', () => {
    render(
      <PriceChangeModal
        visible
        changes={priceChanges}
        onClose={jest.fn()}
        colors={Colors.light}
      />
    );

    expect(screen.getByText('Prices updated')).toBeTruthy();
    expect(screen.getByText('iPhone 15 Pro')).toBeTruthy();
    expect(screen.getByText('Samsung Galaxy S25')).toBeTruthy();
    expect(screen.getByText('₦1,200,000')).toBeTruthy();
    expect(screen.getByText('₦1,250,000')).toBeTruthy();
    expect(screen.getByText('₦980,000')).toBeTruthy();
    expect(screen.getByText('₦970,000')).toBeTruthy();
  });

  it('calls onClose from the backdrop, close button, and continue button', () => {
    const onClose = jest.fn();

    render(
      <PriceChangeModal
        visible
        changes={priceChanges}
        onClose={onClose}
        colors={Colors.light}
      />
    );

    fireEvent.press(screen.getByLabelText('Close modal'));
    fireEvent.press(screen.getByLabelText('Close'));
    fireEvent.press(screen.getByLabelText('Continue with updated prices'));

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
