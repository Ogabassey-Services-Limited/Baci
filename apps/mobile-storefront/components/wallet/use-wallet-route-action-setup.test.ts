import { renderHook } from '@testing-library/react-native';
import { useWalletRouteActionSetup } from '@/components/wallet/use-wallet-route-action-setup';
import { startWalletFundingSession } from '@/lib/wallet-funding-session';

jest.mock('@/lib/wallet-funding-session', () => ({
  startWalletFundingSession: jest.fn(async () => null),
}));

const mockStartSession = jest.mocked(startWalletFundingSession);

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
    customerId: string | undefined;
    hasFundingAccount: boolean;
    hasWalletData: boolean;
    isCreating: boolean;
    needsPhone: boolean;
    routeAction: string | undefined;
  }> = {}
) {
  const {
    canCreateFundingAccount = true,
    createFundingAccount = jest.fn(),
    customerId = 'customer-1',
    hasFundingAccount = false,
    hasWalletData = true,
    isCreating = false,
    needsPhone = false,
    routeAction = 'bank-transfer',
  } = overrides;

  return {
    bankTransfer: {
      canCreateFundingAccount,
      createFundingAccount,
      hasFundingAccount,
      hasWalletData,
      isCreating,
      needsPhone,
    },
    customerId,
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

  it('opens the fund panel and clears the latch when a phone is needed', () => {
    const createFundingAccount = jest.fn();
    const params = buildParams({
      canCreateFundingAccount: false,
      createFundingAccount,
      needsPhone: true,
    });

    const { rerender } = renderHook(
      (props: ReturnType<typeof buildParams>) =>
        useWalletRouteActionSetup(props),
      { initialProps: params }
    );

    // Fund panel opened for the phone prompt; no doomed create call, no
    // silent no-op that leaves the intent latched forever.
    expect(noopSetters.setShowFundPanel).toHaveBeenCalledWith(true);
    expect(createFundingAccount).not.toHaveBeenCalled();

    // Latch cleared: a re-render must not re-open the panel.
    noopSetters.setShowFundPanel.mockClear();
    rerender(
      buildParams({
        canCreateFundingAccount: false,
        createFundingAccount,
        needsPhone: true,
      })
    );
    expect(noopSetters.setShowFundPanel).not.toHaveBeenCalled();
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

  it('re-arms and creates for a new customer on the same bank-transfer route', () => {
    const createFundingAccount = jest.fn();

    const { rerender } = renderHook(
      (props: ReturnType<typeof buildParams>) =>
        useWalletRouteActionSetup(props),
      {
        initialProps: buildParams({
          createFundingAccount,
          customerId: 'customer-1',
        }),
      }
    );

    expect(createFundingAccount).toHaveBeenCalledTimes(1);

    // Same route (action=bank-transfer), but a different customer is now
    // signed in — their own account must be provisioned, not left consumed
    // by the previous customer's latch.
    rerender(buildParams({ createFundingAccount, customerId: 'customer-2' }));

    expect(createFundingAccount).toHaveBeenCalledTimes(2);
  });

  it('starts a persisted funding session on arrival with bank-transfer intent', () => {
    // The session anchors the credit watch's baseline; it must be written at
    // the moment of intent so it survives the customer leaving for their bank
    // app and the screen remounting after the credit already landed.
    renderHook(() => useWalletRouteActionSetup(buildParams()));

    expect(mockStartSession).toHaveBeenCalledWith('customer-1');
  });

  it('does not start a funding session for other route actions or without a customer', () => {
    renderHook(() =>
      useWalletRouteActionSetup(buildParams({ routeAction: 'fund' }))
    );
    expect(mockStartSession).not.toHaveBeenCalled();

    // Auth not hydrated yet: no customer to scope the marker to.
    renderHook(() =>
      useWalletRouteActionSetup({
        ...buildParams(),
        customerId: undefined,
      })
    );
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('starts the new customer’s session when the account switches on a bank-transfer route', () => {
    const { rerender } = renderHook(
      (props: ReturnType<typeof buildParams>) =>
        useWalletRouteActionSetup(props),
      { initialProps: buildParams({ customerId: 'customer-1' }) }
    );

    rerender(buildParams({ customerId: 'customer-2' }));

    expect(mockStartSession).toHaveBeenCalledWith('customer-2');
  });

  it('does not disturb a fund route when the customer hydrates async (undefined→id)', () => {
    // Auth init sets user with customer:null first, then hydrates the
    // customer. A customerId transition on a NON-bank-transfer route must
    // not re-apply the route action (which would re-seed the fund amount).
    const fundParams = (customerId: string | undefined) => ({
      bankTransfer: {
        canCreateFundingAccount: true,
        createFundingAccount: jest.fn(),
        hasFundingAccount: false,
        hasWalletData: true,
        isCreating: false,
        needsPhone: false,
      },
      customerId,
      routeAction: 'fund',
      routeRequiredAmount: '5000',
      walletReturnTo: undefined,
      ...noopSetters,
    });

    const { rerender } = renderHook(
      (props: ReturnType<typeof fundParams>) =>
        useWalletRouteActionSetup(props),
      { initialProps: fundParams(undefined) }
    );

    noopSetters.setFundAmount.mockClear();

    // Customer hydrates on the same fund route.
    rerender(fundParams('customer-1'));

    expect(noopSetters.setFundAmount).not.toHaveBeenCalled();
  });
});
