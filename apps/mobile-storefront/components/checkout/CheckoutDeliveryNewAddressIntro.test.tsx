import { render, screen } from '@testing-library/react-native';
import { CheckoutDeliveryNewAddressIntro } from './CheckoutDeliveryNewAddressIntro';

const mockColors = {
  background: '#ffffff',
  border: '#d1d5db',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
};

describe('CheckoutDeliveryNewAddressIntro', () => {
  it('explains when customers are entering a new delivery address', () => {
    render(
      <CheckoutDeliveryNewAddressIntro colors={mockColors} isDark={false} />
    );

    expect(screen.getByText('New delivery address')).toBeTruthy();
    expect(
      screen.getByText('Use this if this order should go somewhere else.')
    ).toBeTruthy();
    expect(
      screen.getByTestId('checkout-delivery-new-address-icon')
    ).toBeTruthy();
  });

  it('uses the dark-mode intro background', () => {
    render(<CheckoutDeliveryNewAddressIntro colors={mockColors} isDark />);

    expect(
      screen.getByTestId('checkout-delivery-new-address-intro')
    ).toHaveStyle({ backgroundColor: 'rgba(255, 255, 255, 0.04)' });
  });
});
