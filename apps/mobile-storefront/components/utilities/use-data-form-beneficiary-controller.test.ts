import { act, renderHook } from '@testing-library/react-native';
import type { Biller } from '@/hooks/use-vtu-billers';
import { useDataFormBeneficiaryController } from './use-data-form-beneficiary-controller';

const mockDataPlans: Biller[] = [
  {
    billerId: 'mtn-1gb',
    billerName: 'MTN 1GB Data',
    billerType: 'Internet Data',
    categoryId: 'data',
    categoryName: 'Internet Data',
    billItems: [
      {
        amount: 1000,
        isAmountFixed: true,
        itemCode: 'MTN-1GB-MONTHLY',
        itemCurrencySymbol: 'NGN',
        itemFee: 0,
        itemName: 'MTN 1GB Monthly',
      },
    ],
  },
];

const mockRecentRecipient = {
  id: 'data-1',
  title: 'MTN',
  identifierLabel: 'Phone Number',
  identifier: '08031234567',
  meta: '₦1,000',
  defaults: {
    amount: '1000',
    dataPlanCode: 'mtn-1gb',
    isVerified: true,
    networkProvider: 'mtn',
    phoneNumber: '08031234567',
  },
};

describe('useDataFormBeneficiaryController', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() =>
      useDataFormBeneficiaryController({
        initialPhoneNumber: '08031234567',
        parsedInitialAmount: 1000,
        dataPlans: mockDataPlans,
      })
    );

    expect(result.current.phoneNumber).toBe('08031234567');
    expect(result.current.selectedProvider).toBe('mtn');
    expect(result.current.isBeneficiarySelected).toBe(false);
    expect(result.current.planAmount).toBe(1000);
  });

  it('updates phone number and detects provider', () => {
    const { result } = renderHook(() =>
      useDataFormBeneficiaryController({
        parsedInitialAmount: 0,
        dataPlans: mockDataPlans,
      })
    );

    act(() => {
      result.current.handlePhoneChange('08031234567');
    });

    expect(result.current.phoneNumber).toBe('08031234567');
    expect(result.current.selectedProvider).toBe('mtn');
    expect(result.current.selectedDataBiller?.billerId).toBe('mtn-1gb');
  });

  it('selects recent recipient and syncs provider details', () => {
    const onSelectRecentRecipient = jest.fn();
    const { result } = renderHook(() =>
      useDataFormBeneficiaryController({
        parsedInitialAmount: 0,
        dataPlans: mockDataPlans,
        recentRecipients: [mockRecentRecipient],
        onSelectRecentRecipient,
      })
    );

    act(() => {
      result.current.handleSelectRecentRecipient(mockRecentRecipient);
    });

    expect(result.current.phoneNumber).toBe('08031234567');
    expect(result.current.selectedProvider).toBe('mtn');
    expect(result.current.isBeneficiarySelected).toBe(true);
    expect(onSelectRecentRecipient).toHaveBeenCalledWith(mockRecentRecipient);
  });

  it('derives a prefilled wallet return-to href for the current data purchase', () => {
    const { result } = renderHook(() =>
      useDataFormBeneficiaryController({
        initialPhoneNumber: '08031234567',
        initialPlan: 'MTN-1GB-MONTHLY',
        parsedInitialAmount: 1000,
        dataPlans: mockDataPlans,
      })
    );

    expect(result.current.walletReturnToHref).toBe(
      '/utilities/data?repeatAmount=1000&repeatPhoneNumber=08031234567&repeatNetworkProvider=mtn&repeatDataPlanCode=MTN-1GB-MONTHLY'
    );
  });

  it('omits empty fields from the wallet return-to href on an untouched form', () => {
    const { result } = renderHook(() =>
      useDataFormBeneficiaryController({
        parsedInitialAmount: 0,
        dataPlans: mockDataPlans,
      })
    );

    expect(result.current.walletReturnToHref).toBe('/utilities/data');
  });
});
