import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  mockAlert,
  mockCreateOrder,
  mockListSavingsGoals,
  mockRouterReplace,
  mockTrackCheckoutStarted,
  mockTrackError,
  mockUseAuthStatus,
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

  it(
    'renders checkout with address step visible by default',
    async () => {
      renderCheckoutScreen();

      expect(screen.getByText('Checkout')).toBeOnTheScreen();
      expect(screen.getByText('Delivery Address')).toBeOnTheScreen();
      expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
        'step:address'
      );

      await waitFor(() => {
        expect(mockTrackCheckoutStarted).toHaveBeenCalledTimes(1);
      });
    },
    15_000
  );

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

    fireEvent.press(
      screen.getByRole('button', { name: 'Select pickup station' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Continue to payment' })
    );

    await waitFor(() => {
      expect(screen.getByText('Payment Method')).toBeOnTheScreen();
      expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
        'step:payment'
      );
    });
  });

  it('renders the extracted review summary after progressing through checkout', async () => {
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
      expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
        'step:payment'
      );
    });

    fireEvent.press(screen.getByLabelText('Continue to review'));

    await waitFor(() => {
      expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
        'step:review'
      );
      expect(screen.getByText('Review Order')).toBeOnTheScreen();
      expect(screen.getByText('Card Payment (Paystack)')).toBeOnTheScreen();
    });
  });

  it('shows a validation alert when continuing with missing contact details', async () => {
    renderCheckoutScreen();

    fireEvent.press(
      screen.getByRole('button', { name: 'Continue to payment' })
    );

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

  it('forwards checkout savings credit fields when a matching device savings goal is selected', async () => {
    // Arrange
    mockUseAuthStatus.mockReturnValue({
      customer: {
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08031234567',
      },
      isAuthenticated: true,
      isGuest: false,
      isInitialized: true,
      isLoading: false,
      user: { id: 'user-1' },
    });
    mockListSavingsGoals.mockResolvedValue({
      goals: [
        {
          breakFeePercent: 3,
          contributionAmount: 20000,
          contributionFrequency: 'daily',
          currentAmount: 150000,
          id: '123e4567-e89b-12d3-a456-426614174555',
          maturityDate: '2026-06-20',
          productId: 'product-1',
          sourceMode: 'manual',
          startDate: '2026-05-21',
          status: 'active',
          targetAmount: 470000,
          title: 'iPhone savings',
          variantId: null,
        },
      ],
      summary: {
        activeGoalCount: 1,
        savingsBalance: 150000,
      },
    });

    renderCheckoutScreen();

    // Act
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

    fireEvent.press(
      screen.getByRole('button', { name: 'Select pickup station' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Continue to payment' })
    );

    await waitFor(() => {
      expect(screen.getByText('Payment Method')).toBeOnTheScreen();
    });

    await waitFor(() => {
      expect(mockListSavingsGoals).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(
      screen.getByRole('button', { name: 'Mock use checkout savings' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Continue to review' }));

    await waitFor(() => {
      expect(screen.getByText('Review Order')).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByRole('button', { name: /Place order for/i }));

    // Assert
    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          savings_amount: 150000,
          savings_goal_id: '123e4567-e89b-12d3-a456-426614174555',
          use_savings_credit: true,
        })
      );
    });
  });

  it('omits checkout savings credit fields when the selected goal is deselected', async () => {
    // Arrange
    mockUseAuthStatus.mockReturnValue({
      customer: {
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08031234567',
      },
      isAuthenticated: true,
      isGuest: false,
      isInitialized: true,
      isLoading: false,
      user: { id: 'user-1' },
    });
    mockListSavingsGoals.mockResolvedValue({
      goals: [
        {
          breakFeePercent: 3,
          contributionAmount: 20000,
          contributionFrequency: 'daily',
          currentAmount: 150000,
          id: '123e4567-e89b-12d3-a456-426614174555',
          maturityDate: '2026-06-20',
          productId: 'product-1',
          sourceMode: 'manual',
          startDate: '2026-05-21',
          status: 'active',
          targetAmount: 470000,
          title: 'iPhone savings',
          variantId: null,
        },
      ],
      summary: {
        activeGoalCount: 1,
        savingsBalance: 150000,
      },
    });

    renderCheckoutScreen();

    // Act
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
    fireEvent.press(
      screen.getByRole('button', { name: 'Select pickup station' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Continue to payment' })
    );

    await waitFor(() => {
      expect(mockListSavingsGoals).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(
      screen.getByRole('button', { name: 'Mock use checkout savings' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Mock remove checkout savings' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Continue to review' }));

    await waitFor(() => {
      expect(screen.getByText('Review Order')).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByRole('button', { name: /Place order for/i }));

    // Assert
    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });
    const orderPayload = mockCreateOrder.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(orderPayload).not.toHaveProperty('savings_amount');
    expect(orderPayload).not.toHaveProperty('savings_goal_id');
    expect(orderPayload).not.toHaveProperty('use_savings_credit');
  });

  it('skips payment initialization when savings fully pays the order', async () => {
    // Arrange
    mockUseAuthStatus.mockReturnValue({
      customer: {
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08031234567',
      },
      isAuthenticated: true,
      isGuest: false,
      isInitialized: true,
      isLoading: false,
      user: { id: 'user-1' },
    });
    mockListSavingsGoals.mockResolvedValue({
      goals: [
        {
          breakFeePercent: 3,
          contributionAmount: 20000,
          contributionFrequency: 'daily',
          currentAmount: 470000,
          id: '123e4567-e89b-12d3-a456-426614174555',
          maturityDate: '2026-06-20',
          productId: 'product-1',
          sourceMode: 'manual',
          startDate: '2026-05-21',
          status: 'active',
          targetAmount: 470000,
          title: 'iPhone savings',
          variantId: null,
        },
      ],
      summary: {
        activeGoalCount: 1,
        savingsBalance: 470000,
      },
    });
    mockCreateOrder.mockResolvedValueOnce({
      amountDueToGateway: 0,
      order: {
        id: 'order-full-savings',
        order_number: 'ORD-SAVE',
        payment_status: 'paid',
        shipping_status: 'pending',
        total: 470000,
        tracking_token: 'track-1',
      },
      savings: {
        amountUsed: 470000,
        goalId: '123e4567-e89b-12d3-a456-426614174555',
        redemptionId: 'redeem-1',
      },
      wallet: null,
    });

    renderCheckoutScreen();

    // Act
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
    fireEvent.press(
      screen.getByRole('button', { name: 'Select pickup station' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Continue to payment' })
    );

    await waitFor(() => {
      expect(screen.getByText('Payment Method')).toBeOnTheScreen();
    });
    await waitFor(() => {
      expect(mockListSavingsGoals).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(
      screen.getByRole('button', { name: 'Mock use checkout savings' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Continue to review' }));

    await waitFor(() => {
      expect(screen.getByText('Review Order')).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByRole('button', { name: /Place order for/i }));

    // Assert
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/order-success',
        params: expect.objectContaining({
          orderId: 'order-full-savings',
          orderNumber: 'ORD-SAVE',
          paymentMethod: 'savings',
          savingsAmountUsed: '470000',
          trackingToken: 'track-1',
          walletAmountUsed: '0',
        }),
      });
    });
    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        savings_amount: 470000,
        savings_goal_id: '123e4567-e89b-12d3-a456-426614174555',
        use_savings_credit: true,
      })
    );
    const paymentInitializeCalls = (
      global.fetch as jest.Mock
    ).mock.calls.filter(([input]) => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : ((input as { url?: string }).url ?? '');
      return requestUrl.includes('/api/payments/initialize');
    });
    expect(paymentInitializeCalls).toHaveLength(0);
  });

  it('surfaces checkout savings fetch failures with retry UI', async () => {
    // Arrange
    mockUseAuthStatus.mockReturnValue({
      customer: {
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08031234567',
      },
      isAuthenticated: true,
      isGuest: false,
      isInitialized: true,
      isLoading: false,
      user: { id: 'user-1' },
    });
    mockListSavingsGoals
      .mockRejectedValueOnce(new Error('Savings service unavailable'))
      .mockResolvedValueOnce({
        goals: [],
        summary: { activeGoalCount: 0, savingsBalance: 0 },
      });

    renderCheckoutScreen();

    // Act
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
    fireEvent.press(
      screen.getByRole('button', { name: 'Select pickup station' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Continue to payment' })
    );

    // Assert
    expect(await screen.findByText('Savings unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Savings service unavailable')).toBeOnTheScreen();
    expect(mockTrackError).toHaveBeenCalledWith(
      'checkout_savings_goals_fetch',
      'Savings service unavailable',
      { retry_attempt: 0 }
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Retry checkout savings' })
    );

    await waitFor(() => {
      expect(mockListSavingsGoals).toHaveBeenCalledTimes(2);
    });
  });
});
