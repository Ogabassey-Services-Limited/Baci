import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';
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

// --- Beneficiary mocks ---
const mockGetBeneficiaries = jest.fn<() => Promise<UtilityBeneficiary[]>>();
const mockSaveBeneficiary = jest.fn<() => Promise<void>>();
const mockFilterBeneficiaries = jest.fn<
  (
    beneficiaries: UtilityBeneficiary[],
    billerId: string,
    billItemIdentifier: string
  ) => UtilityBeneficiary[]
>();

jest.mock('@/lib/utility-beneficiaries', () => ({
  getBeneficiaries: (...args: unknown[]) => mockGetBeneficiaries(...(args as [])),
  saveBeneficiary: (...args: unknown[]) => mockSaveBeneficiary(...(args as [])),
  filterBeneficiaries: (...args: unknown[]) =>
    mockFilterBeneficiaries(
      ...(args as [UtilityBeneficiary[], string, string])
    ),
}));

const MOCK_BENEFICIARY: UtilityBeneficiary = {
  id: 'ekedc:ekedc:43901766923',
  customerId: '43901766923',
  customerName: 'OLUROTIMI ADEBANJO',
  billerId: 'ekedc',
  billerName: 'EKEDC NG',
  billItemIdentifier: 'ekedc',
  lastUsed: 1000,
};

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
    // Default stubs: empty beneficiaries, passthrough filter
    mockGetBeneficiaries.mockResolvedValue([]);
    mockSaveBeneficiary.mockResolvedValue(undefined);
    mockFilterBeneficiaries.mockReturnValue([]);
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

  // ---- Beneficiary logic tests ----

  it('calls getBeneficiaries on mount to load stored beneficiaries', async () => {
    const useBillFormController = await importController();
    renderHook(() => useBillFormController(makeProps()));

    expect(mockGetBeneficiaries).toHaveBeenCalled();
  });

  it('returns empty beneficiaries when no biller is selected', async () => {
    const useBillFormController = await importController();
    const { result } = renderHook(() => useBillFormController(makeProps()));

    // filterBeneficiaries should not be called because selectedBiller is null
    expect(result.current.beneficiaries).toEqual([]);
  });

  it('returns filtered beneficiaries matching the selected biller and bill item', async () => {
    mockGetBeneficiaries.mockResolvedValue([MOCK_BENEFICIARY]);
    mockFilterBeneficiaries.mockReturnValue([MOCK_BENEFICIARY]);

    const useBillFormController = await importController();
    const { result } = renderHook(() => useBillFormController(makeProps()));

    // Select a biller so the hook computes beneficiaries
    act(() => {
      result.current.handleBillerSelect(MOCK_BILLER as never);
    });

    // Wait for the getBeneficiaries effect to settle
    await waitFor(() => {
      expect(mockFilterBeneficiaries).toHaveBeenCalled();
    });

    expect(result.current.beneficiaries).toEqual([MOCK_BENEFICIARY]);
  });

  it('handleSelectBeneficiary sets customerId and resets verification', async () => {
    const useBillFormController = await importController();
    const { result } = renderHook(() => useBillFormController(makeProps()));

    act(() => {
      result.current.handleBillerSelect(MOCK_BILLER as never);
    });

    act(() => {
      result.current.handleSelectBeneficiary(MOCK_BENEFICIARY);
    });

    expect(result.current.customerId).toBe('43901766923');
    // Verification should be reset (canShowPayment stays false)
    expect(result.current.canShowPayment).toBe(false);
    expect(result.current.isRepeatPaymentActive).toBe(false);
  });

  it('calls saveBeneficiary after successful verification with customerName', async () => {
    const useBillFormController = await importController();

    const { result, rerender } = renderHook(() =>
      useBillFormController(
        makeProps({
          initialBillerName: 'EKEDC NG',
          initialCustomerIdentifier: '43901766923',
        })
      )
    );

    // Select biller + enter customer ID + trigger verify
    act(() => {
      result.current.handleBillerSelect(MOCK_BILLER as never);
    });
    act(() => {
      result.current.updateCustomerId('43901766923');
    });
    act(() => {
      result.current.handleVerify();
    });

    // Simulate verify returning a successful result
    mockVerifyData = { verified: true, customerName: 'VERIFIED OWNER' };
    rerender({});

    await waitFor(() => {
      expect(mockSaveBeneficiary).toHaveBeenCalledWith(
        expect.objectContaining({
          billerId: 'ekedc',
          billerName: 'EKEDC NG',
          customerId: '43901766923',
          customerName: 'VERIFIED OWNER',
        })
      );
    });
  });
});
