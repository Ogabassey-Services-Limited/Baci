import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';
import { useBillFormBeneficiaries } from './use-bill-form-beneficiaries';

const mockGetBeneficiaries =
  jest.fn<(authId: unknown) => Promise<UtilityBeneficiary[]>>();
const mockSaveBeneficiary =
  jest.fn<(authId: unknown, input: unknown) => Promise<void>>();
const mockFilterBeneficiaries =
  jest.fn<
    (
      beneficiaries: UtilityBeneficiary[],
      billerId: string,
      billItemIdentifier: string
    ) => UtilityBeneficiary[]
  >();
const mockTrackError = jest.fn();

jest.mock('@/lib/utility-beneficiaries', () => ({
  filterBeneficiaries: (...args: unknown[]) =>
    mockFilterBeneficiaries(
      ...(args as [UtilityBeneficiary[], string, string])
    ),
  getBeneficiaries: (...args: unknown[]) =>
    mockGetBeneficiaries(...(args as [unknown])),
  saveBeneficiary: (...args: unknown[]) =>
    mockSaveBeneficiary(...(args as [unknown, unknown])),
}));

jest.mock('@/services/analytics', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

const BILLER = {
  billerId: 'ekedc',
  billerName: 'EKEDC NG',
  billerType: 'Electricity',
  categoryId: 'electricity',
  categoryName: 'Electricity',
  billItems: [],
};

const BENEFICIARY: UtilityBeneficiary = {
  billerId: 'ekedc',
  billerName: 'EKEDC NG',
  billItemIdentifier: 'ekedc',
  customerId: '43901766923',
  customerName: 'METER OWNER',
  id: 'ekedc:43901766923',
  lastUsed: 1000,
};

describe('useBillFormBeneficiaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBeneficiaries.mockResolvedValue([]);
    mockSaveBeneficiary.mockResolvedValue(undefined);
    mockFilterBeneficiaries.mockImplementation((beneficiaries) => beneficiaries);
    mockTrackError.mockClear();
  });

  it('loads and filters beneficiaries for the selected biller item', async () => {
    mockGetBeneficiaries.mockResolvedValue([BENEFICIARY]);

    const { result } = renderHook(() =>
      useBillFormBeneficiaries({
        authenticatedCustomerId: 'customer-1',
        saveRequest: null,
        selectedBiller: BILLER,
        selectedBillItemIdentifier: 'ekedc',
      })
    );

    await waitFor(() => {
      expect(result.current).toEqual([BENEFICIARY]);
    });
    expect(mockFilterBeneficiaries).toHaveBeenCalledWith(
      [BENEFICIARY],
      'ekedc',
      'ekedc'
    );
  });

  it('persists a verified beneficiary and reloads scoped beneficiaries', async () => {
    let resolveSave: () => void = () => {};
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    mockGetBeneficiaries.mockResolvedValue([]);
    mockSaveBeneficiary.mockReturnValue(savePromise);

    const { result } = renderHook(() =>
      useBillFormBeneficiaries({
        authenticatedCustomerId: 'customer-1',
        saveRequest: {
          authenticatedCustomerId: 'customer-1',
          billerId: 'ekedc',
          billerName: 'EKEDC NG',
          billItemIdentifier: 'ekedc',
          customerId: '43901766923',
          customerName: 'METER OWNER',
        },
        selectedBiller: BILLER,
        selectedBillItemIdentifier: 'ekedc',
      })
    );

    await waitFor(() => {
      expect(mockSaveBeneficiary).toHaveBeenCalledWith(
        'customer-1',
        expect.objectContaining({ customerName: 'METER OWNER' })
      );
    });
    mockGetBeneficiaries.mockResolvedValue([BENEFICIARY]);
    await act(async () => {
      resolveSave();
      await savePromise;
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current).toEqual([BENEFICIARY]);
    });
  });

  it('ignores stale load results after the auth customer changes', async () => {
    let resolveCustomerA: (value: UtilityBeneficiary[]) => void = () => {};
    const customerAPromise = new Promise<UtilityBeneficiary[]>((resolve) => {
      resolveCustomerA = resolve;
    });
    const customerB = { ...BENEFICIARY, customerName: 'CUSTOMER B' };
    mockGetBeneficiaries.mockImplementation(async (authId) => {
      if (authId === 'customer-A') return customerAPromise;
      if (authId === 'customer-B') return [customerB];
      return [];
    });

    let authenticatedCustomerId = 'customer-A';
    const { result, rerender } = renderHook(() =>
      useBillFormBeneficiaries({
        authenticatedCustomerId,
        saveRequest: null,
        selectedBiller: BILLER,
        selectedBillItemIdentifier: 'ekedc',
      })
    );

    authenticatedCustomerId = 'customer-B';
    rerender({});
    resolveCustomerA([BENEFICIARY]);

    await waitFor(() => {
      expect(result.current).toEqual([customerB]);
    });
  });

  it('keeps beneficiaries empty when loading stored beneficiaries fails', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockGetBeneficiaries.mockRejectedValue(new Error('storage unavailable'));

    const { result } = renderHook(() =>
      useBillFormBeneficiaries({
        authenticatedCustomerId: 'customer-1',
        saveRequest: null,
        selectedBiller: BILLER,
        selectedBillItemIdentifier: 'ekedc',
      })
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'getBeneficiaries failed',
        expect.any(Error)
      );
    });
    expect(result.current).toEqual([]);
    expect(mockTrackError).toHaveBeenCalledWith(
      'utility_beneficiaries_load_failed',
      'storage unavailable',
      { authenticatedCustomerId: 'customer-1' }
    );

    consoleErrorSpy.mockRestore();
  });

  it('keeps existing beneficiaries when saving a verified beneficiary fails', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockSaveBeneficiary.mockRejectedValueOnce(new Error('quota exceeded'));

    const { result } = renderHook(() =>
      useBillFormBeneficiaries({
        authenticatedCustomerId: 'customer-1',
        saveRequest: {
          authenticatedCustomerId: 'customer-1',
          billerId: 'ekedc',
          billerName: 'EKEDC NG',
          billItemIdentifier: 'ekedc',
          customerId: '43901766923',
          customerName: 'METER OWNER',
        },
        selectedBiller: BILLER,
        selectedBillItemIdentifier: 'ekedc',
      })
    );

    await waitFor(() => {
      expect(mockSaveBeneficiary).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'utility-beneficiaries: post-verification save failed',
        expect.any(Error)
      );
    });
    expect(result.current).toEqual([]);
    expect(mockTrackError).toHaveBeenCalledWith(
      'utility_beneficiaries_save_failed',
      'quota exceeded',
      {
        authenticatedCustomerId: 'customer-1',
        billerId: 'ekedc',
        billItemIdentifier: 'ekedc',
      }
    );

    consoleErrorSpy.mockRestore();
  });
});
