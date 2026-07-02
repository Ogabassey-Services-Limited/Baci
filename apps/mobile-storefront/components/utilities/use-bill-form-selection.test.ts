import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import { useBillFormSelection } from './use-bill-form-selection';

function makeBillItem(overrides: Partial<BillItem>): BillItem {
  return {
    amount: 0,
    isAmountFixed: false,
    itemCode: 'item',
    itemCurrencySymbol: 'NGN',
    itemFee: 0,
    itemName: 'Item',
    ...overrides,
  };
}

const PREPAID_ITEM = makeBillItem({
  amount: 12_000,
  isAmountFixed: true,
  itemCode: 'prepaid',
  itemName: 'Prepaid Meter',
});

const POSTPAID_ITEM = makeBillItem({
  amount: 0,
  isAmountFixed: false,
  itemCode: 'postpaid',
  itemName: 'Postpaid Meter',
});

const BILLER: Biller = {
  billerId: 'ekedc',
  billerName: 'EKEDC NG',
  billerType: 'Electricity',
  categoryId: 'electricity',
  categoryName: 'Electricity',
  billItems: [PREPAID_ITEM, POSTPAID_ITEM],
};

const NESTED_BILLER: Biller = {
  ...BILLER,
  billerId: 'ikeja',
  billerName: 'Ikeja Electric',
  billItems: [
    makeBillItem({
      billItems: [PREPAID_ITEM, POSTPAID_ITEM],
      itemCode: 'meter-type',
      itemName: 'Meter Type',
    }),
  ],
};

type UseSelectionInput = Parameters<typeof useBillFormSelection>[0];

function renderSelection(overrides: Partial<UseSelectionInput> = {}) {
  const setAmount = jest.fn();
  const onInitialRepeatPaymentReady = jest.fn();
  const onSelectionChanged = jest.fn();
  const result = renderHook(() =>
    useBillFormSelection({
      billers: [BILLER],
      hasBeneficiaries: false,
      isRepeatPaymentReady: false,
      onInitialRepeatPaymentReady,
      onSelectionChanged,
      setAmount,
      ...overrides,
    })
  );

  return {
    onInitialRepeatPaymentReady,
    onSelectionChanged,
    setAmount,
    ...result,
  };
}

describe('useBillFormSelection', () => {
  it('starts the provider picker collapsed for returning users with beneficiaries', () => {
    const { result } = renderSelection({ hasBeneficiaries: true });

    expect(result.current.isProviderPickerExpanded).toBe(false);
  });

  it('starts the provider picker expanded for first-timers without beneficiaries', () => {
    const { result } = renderSelection({ hasBeneficiaries: false });

    expect(result.current.isProviderPickerExpanded).toBe(true);
  });

  it('collapses the picker when beneficiaries load asynchronously after mount', () => {
    // recentRecipients arrives from a query, so hasBeneficiaries flips
    // false→true after the first render — the picker must still collapse.
    const { result, rerender } = renderHook(
      ({ hasBeneficiaries }: { hasBeneficiaries: boolean }) =>
        useBillFormSelection({
          billers: [BILLER],
          hasBeneficiaries,
          isRepeatPaymentReady: false,
          onInitialRepeatPaymentReady: jest.fn(),
          onSelectionChanged: jest.fn(),
          setAmount: jest.fn(),
        }),
      { initialProps: { hasBeneficiaries: false } }
    );

    expect(result.current.isProviderPickerExpanded).toBe(true);

    rerender({ hasBeneficiaries: true });

    expect(result.current.isProviderPickerExpanded).toBe(false);
  });

  it('initializes a repeat payment when the initial bill item resolves to a leaf', async () => {
    const { onInitialRepeatPaymentReady, result, setAmount } = renderSelection({
      initialBillerName: 'EKEDC NG Prepaid Meter',
      initialBillItemIdentifier: 'prepaid',
      initialCustomerIdentifier: '43901766923',
      isRepeatPaymentReady: true,
    });

    await waitFor(() => {
      expect(result.current.selectedBiller?.billerId).toBe('ekedc');
      expect(result.current.selectedBillItemIdentifier).toBe('prepaid');
    });
    expect(result.current.isProviderPickerExpanded).toBe(false);
    expect(setAmount).toHaveBeenCalledWith('12000');
    expect(onInitialRepeatPaymentReady).toHaveBeenCalledTimes(1);
  });

  it('selects a provider and marks a multi-option bill item selection incomplete', () => {
    const { onSelectionChanged, result, setAmount } = renderSelection();

    act(() => {
      result.current.handleBillerSelect(BILLER);
    });

    expect(result.current.selectedBiller?.billerId).toBe('ekedc');
    expect(result.current.selectedBillItemIdentifier).toBeNull();
    expect(result.current.isBillItemSelectionComplete).toBe(false);
    expect(result.current.isProviderPickerExpanded).toBe(false);
    expect(setAmount).toHaveBeenCalledWith('');
    expect(onSelectionChanged).toHaveBeenCalledTimes(1);
  });

  it('updates bill item selection and amount when a leaf item is selected', () => {
    const { onSelectionChanged, result, setAmount } = renderSelection();

    act(() => {
      result.current.handleBillerSelect(BILLER);
    });
    act(() => {
      result.current.handleBillItemSelect(0, PREPAID_ITEM);
    });

    expect(result.current.selectedBillItemIdentifier).toBe('prepaid');
    expect(result.current.selectedBillItemPathLabel).toBe('Prepaid Meter');
    expect(result.current.isBillItemSelectionComplete).toBe(true);
    expect(setAmount).toHaveBeenLastCalledWith('12000');
    expect(onSelectionChanged).toHaveBeenCalledTimes(2);
  });

  it('does nothing when a bill item is selected before a provider', () => {
    const { onSelectionChanged, result, setAmount } = renderSelection();

    act(() => {
      result.current.handleBillItemSelect(0, PREPAID_ITEM);
    });

    expect(result.current.selectedBiller).toBeNull();
    expect(result.current.selectedBillItemIdentifier).toBeNull();
    expect(setAmount).not.toHaveBeenCalled();
    expect(onSelectionChanged).not.toHaveBeenCalled();
  });

  it('ignores unmatched initial biller names', async () => {
    const {
      onInitialRepeatPaymentReady,
      onSelectionChanged,
      result,
      setAmount,
    } = renderSelection({
      initialBillerName: 'Unknown Provider',
      initialCustomerIdentifier: '43901766923',
      isRepeatPaymentReady: true,
    });

    await waitFor(() => {
      expect(result.current.selectedBiller).toBeNull();
    });
    expect(setAmount).not.toHaveBeenCalled();
    expect(onInitialRepeatPaymentReady).not.toHaveBeenCalled();
    expect(onSelectionChanged).not.toHaveBeenCalled();
  });

  it('does not set amount when an initial bill item resolves to an incomplete branch', async () => {
    const { onInitialRepeatPaymentReady, result, setAmount } = renderSelection({
      billers: [NESTED_BILLER],
      initialBillItemIdentifier: 'meter-type',
      initialCustomerIdentifier: '43901766923',
      isRepeatPaymentReady: true,
    });

    await waitFor(() => {
      expect(result.current.selectedBiller?.billerId).toBe('ikeja');
    });
    expect(result.current.selectedBillItemIdentifier).toBe('meter-type');
    expect(result.current.isBillItemSelectionComplete).toBe(false);
    expect(setAmount).not.toHaveBeenCalled();
    expect(onInitialRepeatPaymentReady).not.toHaveBeenCalled();
  });

  it('does not activate repeat payment without an initial customer identifier', async () => {
    const { onInitialRepeatPaymentReady, result, setAmount } = renderSelection({
      initialBillItemIdentifier: 'prepaid',
      isRepeatPaymentReady: true,
    });

    await waitFor(() => {
      expect(result.current.selectedBillItemIdentifier).toBe('prepaid');
    });
    expect(setAmount).toHaveBeenCalledWith('12000');
    expect(onInitialRepeatPaymentReady).not.toHaveBeenCalled();
  });
});
