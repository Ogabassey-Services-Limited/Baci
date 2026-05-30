import { usePaymentMethodAvailability } from './usePaymentMethodAvailability';

describe('usePaymentMethodAvailability', () => {
  it('flags installments unavailable below BNPL minimum', () => {
    const result = usePaymentMethodAvailability({
      enabledMethods: ['klump'],
      methodDisabledReasons: {},
      orderTotal: 5000,
      selectedMethod: 'klump',
      selectedTab: 'installments',
    });

    const klump = result.filteredMethods.find((method) => method.id === 'klump');
    expect(result.isBNPLEligible).toBe(false);
    expect(klump?.disabled).toBe(true);
    expect(klump?.disabledReason).toContain('Minimum order');
  });

  it('disables klump when wallet credit is active', () => {
    const result = usePaymentMethodAvailability({
      enabledMethods: ['klump'],
      methodDisabledReasons: {},
      orderTotal: 100000,
      selectedMethod: 'klump',
      selectedTab: 'installments',
      walletSelection: { amount: 10000, use: true },
    });

    const klump = result.filteredMethods.find((method) => method.id === 'klump');
    expect(klump?.disabled).toBe(true);
    expect(klump?.disabledReason).toBe(
      'Wallet credit cannot be combined with Klump'
    );
  });

  it('disables klump when savings credit is active', () => {
    const result = usePaymentMethodAvailability({
      enabledMethods: ['klump'],
      methodDisabledReasons: {},
      orderTotal: 100000,
      savingsSelection: {
        amount: 5000,
        goalId: 'goal-1',
        use: true,
      },
      selectedMethod: 'klump',
      selectedTab: 'installments',
    });

    const klump = result.filteredMethods.find((method) => method.id === 'klump');
    expect(klump?.disabled).toBe(true);
    expect(klump?.disabledReason).toBe(
      'Device savings cannot be combined with Klump'
    );
  });

  it('respects explicit methodDisabledReasons overrides', () => {
    const result = usePaymentMethodAvailability({
      enabledMethods: ['paystack'],
      methodDisabledReasons: { paystack: 'Temporarily unavailable' },
      orderTotal: 100000,
      selectedMethod: 'paystack',
      selectedTab: 'full',
    });

    const paystack = result.filteredMethods.find(
      (method) => method.id === 'paystack'
    );
    expect(paystack?.disabled).toBe(true);
    expect(paystack?.disabledReason).toBe('Temporarily unavailable');
  });
});
