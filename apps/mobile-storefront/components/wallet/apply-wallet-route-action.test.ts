import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { applyWalletRouteAction } from './apply-wallet-route-action';

function createSetters() {
  return {
    setFundAmount: jest.fn<(value: string) => void>(),
    setFundReturnTo: jest.fn<(value: string | undefined) => void>(),
    setShowFundPanel: jest.fn<(value: boolean) => void>(),
    setShowRedeemPanel: jest.fn<(value: boolean) => void>(),
    setShowSavingsProgressModal: jest.fn<(value: boolean) => void>(),
  };
}

describe('applyWalletRouteAction', () => {
  const setters = createSetters();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens only the fund panel and seeds its amount for fund actions', () => {
    applyWalletRouteAction({
      routeAction: 'fund',
      routeRequiredAmount: '5000',
      walletReturnTo: '/checkout',
      ...setters,
    });

    expect(setters.setShowFundPanel).toHaveBeenCalledWith(true);
    expect(setters.setShowRedeemPanel).toHaveBeenCalledWith(false);
    expect(setters.setShowSavingsProgressModal).toHaveBeenCalledWith(false);
    expect(setters.setFundAmount).toHaveBeenCalledWith('5000');
    expect(setters.setFundReturnTo).toHaveBeenCalledWith('/checkout');
  });

  it('opens only the redeem panel for redeem actions', () => {
    applyWalletRouteAction({
      routeAction: 'redeem',
      routeRequiredAmount: '',
      walletReturnTo: undefined,
      ...setters,
    });

    expect(setters.setShowRedeemPanel).toHaveBeenCalledWith(true);
    expect(setters.setShowFundPanel).toHaveBeenCalledWith(false);
    expect(setters.setShowSavingsProgressModal).toHaveBeenCalledWith(false);
  });

  it('opens only the savings modal and closes other panels for savings actions', () => {
    applyWalletRouteAction({
      routeAction: 'savings',
      routeRequiredAmount: '',
      walletReturnTo: undefined,
      ...setters,
    });

    expect(setters.setShowSavingsProgressModal).toHaveBeenCalledWith(true);
    expect(setters.setShowFundPanel).toHaveBeenCalledWith(false);
    expect(setters.setShowRedeemPanel).toHaveBeenCalledWith(false);
  });

  it('closes every panel for bank-transfer actions (funding account lives in the hero)', () => {
    applyWalletRouteAction({
      routeAction: 'bank-transfer',
      routeRequiredAmount: '',
      walletReturnTo: undefined,
      ...setters,
    });

    expect(setters.setShowFundPanel).toHaveBeenCalledWith(false);
    expect(setters.setShowRedeemPanel).toHaveBeenCalledWith(false);
    expect(setters.setShowSavingsProgressModal).toHaveBeenCalledWith(false);
    expect(setters.setFundAmount).not.toHaveBeenCalled();
  });

  it('does nothing for unrecognized route actions', () => {
    applyWalletRouteAction({
      routeAction: undefined,
      routeRequiredAmount: '',
      walletReturnTo: undefined,
      ...setters,
    });

    expect(setters.setShowFundPanel).not.toHaveBeenCalled();
    expect(setters.setShowRedeemPanel).not.toHaveBeenCalled();
    expect(setters.setShowSavingsProgressModal).not.toHaveBeenCalled();
  });

  it("leaves all panel state untouched for unsupported string actions like 'deposit'", () => {
    applyWalletRouteAction({
      routeAction: 'deposit',
      routeRequiredAmount: '2500',
      walletReturnTo: '/checkout',
      ...setters,
    });

    expect(setters.setShowFundPanel).not.toHaveBeenCalled();
    expect(setters.setShowRedeemPanel).not.toHaveBeenCalled();
    expect(setters.setShowSavingsProgressModal).not.toHaveBeenCalled();
    expect(setters.setFundAmount).not.toHaveBeenCalled();
    expect(setters.setFundReturnTo).not.toHaveBeenCalled();
  });
});
