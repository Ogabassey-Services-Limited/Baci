import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  mockAlert,
  mockTrackCheckoutStarted,
  renderCheckoutScreen,
  setupCheckoutTest,
  teardownCheckoutTest,
} from './checkout.test-utils';

describe('CheckoutScreen', () => {
  beforeEach(() => {
    setupCheckoutTest();
  });

  afterEach(() => {
    teardownCheckoutTest();
  });

  it('renders checkout with address step visible by default', async () => {
    renderCheckoutScreen();

    expect(screen.getByText('Checkout')).toBeOnTheScreen();
    expect(screen.getByText('Delivery Address')).toBeOnTheScreen();
    expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
      'step:address'
    );

    await waitFor(() => {
      expect(mockTrackCheckoutStarted).toHaveBeenCalledTimes(1);
    });
  });

  it('continues from address to payment when required fields are valid', async () => {
    renderCheckoutScreen();

    fireEvent.changeText(screen.getByPlaceholderText('E.g. John'), 'Ada');
    fireEvent.changeText(screen.getByPlaceholderText('E.g. Doe'), 'Lovelace');
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. 08012345678'),
      '08031234567'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('john@example.com'),
      'ada@example.com'
    );

    fireEvent.press(screen.getByLabelText('Select pickup station'));
    fireEvent.press(screen.getByLabelText('Continue to payment'));

    await waitFor(() => {
      expect(screen.getByText('Payment Method')).toBeOnTheScreen();
      expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
        'step:payment'
      );
    });
  });

  it('shows a validation alert when continuing with missing contact details', async () => {
    renderCheckoutScreen();

    fireEvent.press(screen.getByLabelText('Continue to payment'));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Incomplete Details',
        'Email address is required',
        [{ text: 'OK' }]
      );
    });

    expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
      'step:address'
    );
  });
});
