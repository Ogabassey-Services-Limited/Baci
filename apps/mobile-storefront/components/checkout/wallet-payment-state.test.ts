import { getWalletPaymentState } from './wallet-payment-state';

const baseInput = {
  activeSavingsAmount: 0,
  orderTotal: 5000,
  selectedMethod: 'paystack' as const,
  selectedTab: 'full' as const,
  supportsPartialPayment: true,
  walletBalance: 3000,
  walletError: null,
  walletFundedBankTransferMode: false,
  walletIsLoading: false,
  walletMode: 'orders' as const,
  walletOrderTotal: 5000,
};

describe('getWalletPaymentState', () => {
  it('keeps wallet UI hidden when the caller has not opted in', () => {
    const state = getWalletPaymentState({
      ...baseInput,
      walletMode: 'off',
    });

    expect(state.shouldRender).toBe(false);
    expect(state.infoShouldRender).toBe(false);
    expect(state.statusShouldRender).toBe(false);
  });

  it('shows the selectable wallet row for partial real-time gateway payments', () => {
    const state = getWalletPaymentState(baseInput);

    expect(state.shouldRender).toBe(true);
    expect(state.portion).toBe(3000);
    expect(state.residualToGateway).toBe(2000);
    expect(state.coversFully).toBe(false);
  });

  it('uses savings-reduced residuals for wallet coverage', () => {
    const state = getWalletPaymentState({
      ...baseInput,
      activeSavingsAmount: 2000,
    });

    expect(state.effectiveTotal).toBe(3000);
    expect(state.coversFully).toBe(true);
    expect(state.portion).toBe(3000);
  });

  it('covers exactly when wallet balance equals the effective total', () => {
    const state = getWalletPaymentState({
      ...baseInput,
      walletBalance: 5000,
    });

    expect(state.coversFully).toBe(true);
    expect(state.portion).toBe(5000);
    expect(state.residualToGateway).toBe(0);
  });

  it('does not render when the effective total is zero', () => {
    const state = getWalletPaymentState({
      ...baseInput,
      orderTotal: 0,
      walletOrderTotal: 0,
    });

    expect(state.effectiveTotal).toBe(0);
    expect(state.shouldRender).toBe(false);
    expect(state.infoShouldRender).toBe(false);
    expect(state.statusShouldRender).toBe(false);
  });

  it('clamps savings over-coverage to a zero effective total', () => {
    const state = getWalletPaymentState({
      ...baseInput,
      activeSavingsAmount: 6000,
    });

    expect(state.effectiveTotal).toBe(0);
    expect(state.shouldRender).toBe(false);
    expect(state.portion).toBe(0);
  });

  it.each([
    undefined,
    null,
  ])('treats %s wallet balance as unavailable', (walletBalance) => {
    const state = getWalletPaymentState({
      ...baseInput,
      walletBalance,
    });

    expect(state.shouldRender).toBe(false);
    expect(state.portion).toBe(0);
    expect(state.residualToGateway).toBe(0);
  });

  it('renders wallet as informational during wallet-funded bank transfer', () => {
    const state = getWalletPaymentState({
      ...baseInput,
      selectedMethod: 'bank_transfer',
      walletFundedBankTransferMode: true,
    });

    expect(state.shouldRender).toBe(false);
    expect(state.infoShouldRender).toBe(true);
    expect(state.portion).toBe(3000);
  });

  it('shows a status row while wallet balance is loading', () => {
    const state = getWalletPaymentState({
      ...baseInput,
      walletBalance: 0,
      walletIsLoading: true,
    });

    expect(state.shouldRender).toBe(false);
    expect(state.statusShouldRender).toBe(true);
  });

  it.each([
    'paystack',
    'korapay',
    'bank_transfer',
  ] as const)('allows %s when wallet-funded bank transfer mode is off', (selectedMethod) => {
    const state = getWalletPaymentState({
      ...baseInput,
      selectedMethod,
      walletFundedBankTransferMode: false,
    });

    expect(state.shouldRender).toBe(true);
    expect(state.infoShouldRender).toBe(false);
  });
});
