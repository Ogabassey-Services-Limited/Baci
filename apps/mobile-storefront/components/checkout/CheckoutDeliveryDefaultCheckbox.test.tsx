import { fireEvent, render, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import { BRAND } from '@/constants/Colors';
import { CheckoutDeliveryDefaultCheckbox } from './CheckoutDeliveryDefaultCheckbox';

const mockColors = {
  background: '#ffffff',
  border: '#d1d5db',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
};

describe('CheckoutDeliveryDefaultCheckbox', () => {
  it('toggles the default-address checkbox action', () => {
    const onToggle = jest.fn();

    render(
      <CheckoutDeliveryDefaultCheckbox
        checked={false}
        colors={mockColors}
        label="Set as default address"
        onToggle={onToggle}
      />
    );

    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Set as default address' })
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders with checked state and displays the checkmark', () => {
    render(
      <CheckoutDeliveryDefaultCheckbox
        checked
        colors={mockColors}
        label="Set as default address"
        onToggle={jest.fn()}
      />
    );

    expect(
      screen.getByRole('checkbox', { name: 'Set as default address' })
    ).toHaveAccessibilityState({ checked: true });
    expect(
      screen.getByTestId('checkout-delivery-default-checkbox-checkmark')
    ).toBeTruthy();
    expect(
      screen.getByTestId('checkout-delivery-default-checkbox-box')
    ).toHaveStyle({ borderColor: BRAND.primary });
  });
});
