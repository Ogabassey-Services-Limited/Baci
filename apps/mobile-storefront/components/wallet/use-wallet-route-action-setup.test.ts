import { renderHook } from '@testing-library/react-native';
import { useWalletRouteActionSetup } from '@/components/wallet/use-wallet-route-action-setup';

const noopSetters = {
  setFundAmount: jest.fn(),
  setFundReturnTo: jest.fn(),
  setShowFundPanel: jest.fn(),
  setShowRedeemPanel: jest.fn(),
  setShowSavingsProgressModal: jest.fn(),
};

function buildParams(
  overrides: Partial<{
    canCreateFundingAccount: boolean;
    createFundingAccount: () => void;
    hasFundingAccount: boolean;
    hasWalletData: boolean;
    isCreating: boolean;
    routeAction: string | undefined;
  }> = {}
) {
  const {
    canCreateFundingAccount = true,
    createFundingAccount = jest.fn(),
    hasFundingAccount = false,
    hasWalletData = true,
    isCreating = false,
    routeAction = 'bank-transfer',
  } = overrides;

  return {
    bankTransfer: {
      canCreateFundingAccount,
      createFundingAccount,
      hasFundingAccount,
      hasWalletData,
      isCreating,
    },
    routeAction,
    routeRequiredAmount: '',
    walletReturnTo: undefined,
    ...noopSetters,
  };
}

describe('useWalletRouteActionSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the funding account once for action=bank-transfer when none exists', () => {
    const createFundingAccount = jest.fn();
    const params = buildParams({ createFundingAccount });

    const { rerender } = renderHook(
      (props: ReturnType<typeof buildParams>) =>
        useWalletRouteActionSetup(props),
      { initialProps: params }
    );

    expect(createFundingAccount).toHaveBeenCalledTimes(1);

    rerender(buildParams({ createFundingAccount }));

    expect(createFundingAccount).toHaveBeenCalledTimes(1);
  });

  it('does not create an account when one already exists', () => {
    const createFundingAccount = jest.fn();

    renderHook(() =>
      useWalletRouteActionSetup(
        buildParams({ createFundingAccount, hasFundingAccount: true })
      )
    );

    expect(createFundingAccount).not.toHaveBeenCalled();
  });

  it('waits for the wallet data to load before creating', () => {
    const createFundingAccount = jest.fn();
    const initial = buildParams({ createFundingAccount, hasWalletData: false });

    const { rerender } = renderHook(
      (props: ReturnType<typeof buildParams>) =>
        useWalletRouteActionSetup(props),
      { initialProps: initial }
    );

    expect(createFundingAccount).not.toHaveBeenCalled();

    rerender(buildParams({ createFundingAccount, hasWalletData: true }));

    expect(createFundingAccount).toHaveBeenCalledTimes(1);
  });

  it('does not create when the merchant has funding accounts disabled', () => {
    const createFundingAccount = jest.fn();

    renderHook(() =>
      useWalletRouteActionSetup(
        buildParams({ canCreateFundingAccount: false, createFundingAccount })
      )
    );

    expect(createFundingAccount).not.toHaveBeenCalled();
  });

  it('does nothing for non-bank-transfer actions', () => {
    const createFundingAccount = jest.fn();

    renderHook(() =>
      useWalletRouteActionSetup(
        buildParams({ createFundingAccount, routeAction: 'fund' })
      )
    );

    expect(createFundingAccount).not.toHaveBeenCalled();
  });
});
