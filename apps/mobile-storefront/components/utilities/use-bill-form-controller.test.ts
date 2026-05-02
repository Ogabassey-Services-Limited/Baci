import { jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { BillFormProps } from './bill-form.types';

const mockVerifyMutate = jest.fn();
const mockVerifyReset = jest.fn();

let mockVerifyData: { verified: boolean; customerName?: string | null } | undefined =
  undefined;
let mockVerifyIsPending = false;

jest.mock('@/hooks/use-vtu-verify', () => ({
  useVTUVerify: () => ({
    data: mockVerifyData,
    error: null,
    isPending: mockVerifyIsPending,
    mutate: mockVerifyMutate,
    reset: mockVerifyReset,
  }),
}));

const MOCK_BILLER = {
  billerId: 'ekedc',
  billerName: 'EKEDC NG',
  billerType: 'Electricity',
  categoryId: 'electricity',
  billItems: [],
};

jest.mock('@/hooks/use-vtu-billers', () => ({
  useVTUBillers: () => ({ data: [MOCK_BILLER], isLoading: false }),
}));

jest.mock('@/hooks/use-utility-payment', () => ({
  useUtilityPayment: () => ({
    cards: [],
    isLoadingCards: false,
    refetchCards: jest.fn(),
    selectGateway: jest.fn(),
    selectSavedCard: jest.fn(),
    selectedGateway: 'paystack',
    selectedSavedCardId: null,
    supportedGateways: ['paystack'],
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (state: { customer: null }) => null) =>
    selector({ customer: null })
  ),
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => ({
    dismissKeyboard: jest.fn(),
    isKeyboardVisible: false,
    keyboardHeight: 0,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('./use-next-step-scroll', () => ({
  useNextStepScroll: () => jest.fn(),
}));

jest.mock('./create-bill-form-purchase-handler', () => ({
  createBillFormPurchaseHandler: () => jest.fn(),
}));

function makeProps(overrides: Partial<BillFormProps> = {}): BillFormProps {
  return {
    type: 'power',
    onSuccess: jest.fn(),
    ...overrides,
  };
}

async function importController() {
  const { useBillFormController } = await import('./use-bill-form-controller');
  return useBillFormController;
}

describe('useBillFormController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyData = undefined;
    mockVerifyIsPending = false;
  });

  it('initializes verifiedCustomerName from initialCustomerName', async () => {
    const useBillFormController = await importController();
    const { result } = renderHook(() =>
      useBillFormController(makeProps({ initialCustomerName: 'JANE METER-OWNER' }))
    );

    expect(result.current.verifiedCustomerName).toBe('JANE METER-OWNER');
  });

  it('verifiedCustomerName is null when no initialCustomerName is given', async () => {
    const useBillFormController = await importController();
    const { result } = renderHook(() => useBillFormController(makeProps()));

    expect(result.current.verifiedCustomerName).toBeNull();
  });

  it('sets verifiedCustomerName from live verify response when customerName is provided', async () => {
    const useBillFormController = await importController();

    const { result, rerender } = renderHook(() =>
      useBillFormController(
        makeProps({
          initialBillerName: 'EKEDC NG',
          initialCustomerIdentifier: '43901766923',
        })
      )
    );

    // Select a biller and enter a customer ID so handleVerify can proceed
    act(() => {
      result.current.handleBillerSelect(MOCK_BILLER as never);
    });
    act(() => {
      result.current.updateCustomerId('43901766923');
    });
    act(() => {
      result.current.handleVerify();
    });

    // Simulate the verify mutation returning a successful result with a name
    mockVerifyData = { verified: true, customerName: 'LIVE METER OWNER' };
    rerender({});

    expect(result.current.verifiedCustomerName).toBe('LIVE METER OWNER');
  });

  it('clears verifiedCustomerName when live verify returns verified=true but no customerName', async () => {
    const useBillFormController = await importController();

    const { result, rerender } = renderHook(() =>
      useBillFormController(
        makeProps({
          initialBillerName: 'EKEDC NG',
          initialCustomerIdentifier: '43901766923',
          initialCustomerName: 'OLD NAME',
        })
      )
    );

    expect(result.current.verifiedCustomerName).toBe('OLD NAME');

    act(() => {
      result.current.handleBillerSelect(MOCK_BILLER as never);
    });
    act(() => {
      result.current.updateCustomerId('43901766923');
    });
    act(() => {
      result.current.handleVerify();
    });

    // Verify succeeds but returns no name — stale name should be cleared
    mockVerifyData = { verified: true, customerName: '' };
    rerender({});

    expect(result.current.verifiedCustomerName).toBeNull();
  });

  it('deactivateRepeatPayment clears both isRepeatPaymentActive and verifiedCustomerName', async () => {
    const useBillFormController = await importController();
    const { result } = renderHook(() =>
      useBillFormController(
        makeProps({ initialCustomerName: 'SOME OWNER', isRepeatPaymentReady: true })
      )
    );

    act(() => {
      result.current.setRepeatPaymentActive(false);
    });

    expect(result.current.isRepeatPaymentActive).toBe(false);
    expect(result.current.verifiedCustomerName).toBeNull();
  });
});
