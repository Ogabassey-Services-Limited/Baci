import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { CheckoutReviewStep } from './CheckoutReviewStep';

const baseProps = {
  address: {
    address: '10 Admiralty Way',
    city: 'Lagos',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '08031234567',
    state: 'Lagos',
  },
  assuranceFee: 2500,
  colors: Colors.dark,
  deliveryFee: 5000,
  deliveryMethod: 'door' as const,
  formContentPaddingBottom: 124,
  isDark: true,
  items: [
    {
      id: 'item-1',
      name: 'iPhone 11 Pro Max',
      price: 470000,
      product_id: 'product-1',
      quantity: 1,
      slug: 'iphone-11-pro-max',
    },
  ],
  onEditAddress: jest.fn(),
  onEditPayment: jest.fn(),
  selectedPayment: 'paystack' as const,
  selectedQuote: {
    deliveryRange: '1-2 days',
    displayName: 'Express delivery',
    id: 'quote-1',
    price: 5000,
  },
  subtotal: 470000,
  taxAmount: 35250,
  taxRate: 0.075,
  total: 512750,
};

describe('CheckoutReviewStep', () => {
  it('renders review details with themed actions and allows editing prior steps', () => {
    render(<CheckoutReviewStep {...baseProps} />);

    expect(screen.getByText('Review Order')).toBeOnTheScreen();
    expect(screen.getByText('Express delivery • 1-2 days')).toBeOnTheScreen();
    expect(screen.getByText('Card Payment (Paystack)')).toBeOnTheScreen();
    expect(screen.getByText('VAT (7.5%)')).toBeOnTheScreen();
    expect(screen.getByText('₦512,750')).toHaveStyle({
      color: Colors.dark.primary,
    });

    fireEvent.press(
      screen.getByRole('button', { name: 'Edit delivery method' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Edit payment method' })
    );

    expect(baseProps.onEditAddress).toHaveBeenCalledTimes(1);
    expect(baseProps.onEditPayment).toHaveBeenCalledTimes(1);
  });

  it('renders pickup station delivery and omits tax when no calculated tax exists', () => {
    render(
      <CheckoutReviewStep
        {...baseProps}
        deliveryMethod="pickup_station"
        selectedPayment="invoice"
        selectedQuote={undefined}
        taxAmount={null}
        taxRate={0}
      />
    );

    expect(
      screen.getByText(/2 Olaide Tomori Street Ikeja Lagos/)
    ).toBeOnTheScreen();
    expect(screen.getByText('Generate Invoice')).toBeOnTheScreen();
    expect(screen.queryByText(/VAT/)).toBeNull();
  });

  it('clarifies airport delivery goes to the doorstep on review', () => {
    render(
      <CheckoutReviewStep
        {...baseProps}
        deliveryMethod="airport"
        selectedQuote={undefined}
      />
    );

    expect(screen.getByText('Airport Delivery')).toBeOnTheScreen();
    expect(
      screen.getByText('Delivery to your doorstep • Est. 24–48 working hours')
    ).toBeOnTheScreen();
  });
});
