import { render, screen } from '@testing-library/react-native';
import { OrderDetailsShippingAddressCard } from './OrderDetailsShippingAddressCard';

const colors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('OrderDetailsShippingAddressCard', () => {
  it('renders full shipping address fields', () => {
    render(
      <OrderDetailsShippingAddressCard
        colors={colors}
        isDark={false}
        shippingAddress={{
          name: 'John Doe',
          phone: '08012345678',
          address: '12 Admiralty Way',
          city: 'Lagos',
          state: 'Lagos',
        }}
      />
    );

    expect(screen.getByText('Shipping Address')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('08012345678')).toBeTruthy();
    expect(screen.getByText('12 Admiralty Way')).toBeTruthy();
    expect(screen.getByText('Lagos, Lagos')).toBeTruthy();
  });

  it('renders only available fields when parts are missing', () => {
    render(
      <OrderDetailsShippingAddressCard
        colors={colors}
        isDark
        shippingAddress={{
          phone: '08099998888',
          state: 'Rivers',
        }}
      />
    );

    expect(screen.getByText('08099998888')).toBeTruthy();
    expect(screen.getByText('Rivers')).toBeTruthy();
    expect(screen.queryByText('John Doe')).toBeNull();
    expect(screen.queryByText('Lagos, Lagos')).toBeNull();
  });
});
