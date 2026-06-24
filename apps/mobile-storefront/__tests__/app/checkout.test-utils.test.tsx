import { screen, waitFor } from '@testing-library/react-native';
import {
  getPaymentInitializeCalls,
  mockCreateOrder,
  mockCryptoRandomUUID,
  mockPaymentSettings,
  renderCheckoutScreen,
  setupCheckoutTest,
  teardownCheckoutTest,
} from './checkout.test-utils';

describe('checkout test utilities', () => {
  afterEach(() => {
    teardownCheckoutTest();
  });

  it('resets checkout mocks to deterministic defaults', async () => {
    Object.assign(mockPaymentSettings, {
      klump_enabled: true,
      paystack_enabled: false,
    });
    mockCryptoRandomUUID.mockReturnValue('dirty-key');

    setupCheckoutTest();

    expect(mockPaymentSettings.klump_enabled).toBe(false);
    expect(mockPaymentSettings.paystack_enabled).toBe(true);
    expect(mockCryptoRandomUUID()).toBe('mobile-test-key-1');
    expect(mockCryptoRandomUUID()).toBe('mobile-test-key-2');
    await expect(mockCreateOrder()).resolves.toMatchObject({
      order: {
        id: 'order-1',
        order_number: 'ORD-001',
      },
    });
  });

  it('tracks only payment initialize calls from the checkout fetch mock', async () => {
    const originalFetch = global.fetch;

    setupCheckoutTest();

    expect(global.fetch).not.toBe(originalFetch);
    await global.fetch('https://example.test/api/payments/initialize');
    await global.fetch('https://example.test/api/shipping/locations');

    expect(getPaymentInitializeCalls()).toHaveLength(1);

    teardownCheckoutTest();
    expect(global.fetch).toBe(originalFetch);
  });

  it('renders the checkout route with the default test harness', async () => {
    setupCheckoutTest();

    renderCheckoutScreen();

    expect(screen.getByText('Checkout')).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.getByText('Delivery Address')).toBeOnTheScreen();
    });
  });
});
