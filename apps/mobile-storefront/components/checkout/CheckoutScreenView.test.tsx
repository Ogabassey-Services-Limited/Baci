import { screen } from '@testing-library/react-native';
import {
  renderCheckoutScreen,
  setupCheckoutTest,
  teardownCheckoutTest,
} from '../../__tests__/app/checkout.test-utils';

describe('CheckoutScreenView', () => {
  beforeEach(() => {
    setupCheckoutTest();
  });

  afterEach(() => {
    teardownCheckoutTest();
  });

  it('renders the checkout header through the route shell', () => {
    renderCheckoutScreen();
    expect(screen.getByText('Checkout')).toBeOnTheScreen();
  });
});
