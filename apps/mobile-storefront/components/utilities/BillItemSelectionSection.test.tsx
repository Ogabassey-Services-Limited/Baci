import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import Colors from '@/constants/Colors';
import type { BillItem } from '@/hooks/use-vtu-billers';
import type { useVTUVerify } from '@/hooks/use-vtu-verify';
import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';
import { BillItemSelectionSection } from './BillItemSelectionSection';
import type { BillItemSelectionState } from './bill-item-selection';

type VerifyState = ReturnType<typeof useVTUVerify>;
type BillItemSelectionSectionProps = ComponentProps<
  typeof BillItemSelectionSection
>;

const billItemSelection: BillItemSelectionState = {
  isComplete: true,
  leaf: null,
  levels: [],
  selectedPath: [],
};

function createVerifyState(overrides: Partial<VerifyState>): VerifyState {
  return {
    data: undefined,
    error: null,
    isPending: false,
    mutate: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as VerifyState;
}

const defaultProps = {
  beneficiaries: [],
  billItemSelection,
  colors: Colors.light,
  customerId: '',
  handleBillItemSelect: jest.fn<(depth: number, billItem: BillItem) => void>(),
  handleSelectBeneficiary: jest.fn<(beneficiary: UtilityBeneficiary) => void>(),
  handleVerify: jest.fn(),
  isBillItemSelectionComplete: true,
  isRepeatPaymentActive: false,
  selectedBillItemIdentifier: 'KUD-ELE-EKED-002',
  selectedBillerId: 'EKEDC_NG',
  setCustomerId: jest.fn(),
  setIsRepeatPaymentActive: jest.fn(),
  type: 'power',
  verify: createVerifyState({}),
  recentRecipients: [],
  onSelectRecentRecipient: jest.fn(),
} satisfies BillItemSelectionSectionProps;

const recentRecipient: UtilityRepeatRecipient = {
  id: 'recent-1',
  title: 'JANE CUSTOMER',
  identifierLabel: 'Meter Number',
  identifier: '43901766923',
  meta: '₦2,500',
  defaults: {
    amount: '2500',
    billerName: 'EKEDC NG',
    billItemIdentifier: 'EKEDC_PREPAID',
    customerIdentifier: '43901766923',
    customerName: 'JANE CUSTOMER',
    isVerified: true,
  },
};

describe('BillItemSelectionSection', () => {
  it('shows a plain-object verification error message', () => {
    render(
      <BillItemSelectionSection
        beneficiaries={[]}
        billItemSelection={billItemSelection}
        colors={Colors.light}
        customerId="1234567890"
        handleBillItemSelect={jest.fn<
          (depth: number, billItem: BillItem) => void
        >()}
        handleSelectBeneficiary={jest.fn<
          (beneficiary: UtilityBeneficiary) => void
        >()}
        handleVerify={jest.fn()}
        isBillItemSelectionComplete={true}
        isRepeatPaymentActive={false}
        selectedBillItemIdentifier="postpaid"
        selectedBillerId="ekedc"
        setCustomerId={jest.fn()}
        setIsRepeatPaymentActive={jest.fn()}
        type="power"
        verify={createVerifyState({
          // Intentional type workaround: this verifies plain object errors with
          // message properties render like Error instances.
          error: {
            message: 'Meter number not found',
          } as unknown as VerifyState['error'],
        })}
      />
    );

    expect(screen.getByText('Meter number not found')).toBeOnTheScreen();
  });

  it('shows the repeat customer name as a verified meter owner during repeat', () => {
    render(
      <BillItemSelectionSection
        billItemSelection={billItemSelection}
        colors={Colors.light}
        customerId="43901766923"
        handleBillItemSelect={jest.fn<
          (depth: number, billItem: BillItem) => void
        >()}
        handleVerify={jest.fn()}
        beneficiaries={[]}
        handleSelectBeneficiary={jest.fn<
          (beneficiary: UtilityBeneficiary) => void
        >()}
        isBillItemSelectionComplete={true}
        isRepeatPaymentActive={true}
        verifiedCustomerName="JANE CUSTOMER"
        selectedBillItemIdentifier="prepaid"
        selectedBillerId="ekedc"
        setCustomerId={jest.fn()}
        setIsRepeatPaymentActive={jest.fn()}
        type="power"
        verify={createVerifyState({})}
      />
    );

    expect(screen.getByText('JANE CUSTOMER')).toBeOnTheScreen();
    expect(screen.getByText('Customer verified')).toBeOnTheScreen();
    expect(
      screen.getByText('Using details from your previous successful purchase.')
    ).toBeOnTheScreen();
  });

  it('shows the repeat banner without a verification card when no name is known', () => {
    render(
      <BillItemSelectionSection
        billItemSelection={billItemSelection}
        colors={Colors.light}
        customerId="43901766923"
        handleBillItemSelect={jest.fn<
          (depth: number, billItem: BillItem) => void
        >()}
        handleVerify={jest.fn()}
        beneficiaries={[]}
        handleSelectBeneficiary={jest.fn<
          (beneficiary: UtilityBeneficiary) => void
        >()}
        isBillItemSelectionComplete={true}
        isRepeatPaymentActive={true}
        selectedBillItemIdentifier="prepaid"
        selectedBillerId="ekedc"
        setCustomerId={jest.fn()}
        setIsRepeatPaymentActive={jest.fn()}
        type="power"
        verify={createVerifyState({})}
      />
    );

    expect(screen.queryByText('Customer verified')).toBeNull();
    expect(
      screen.getByText('Using details from your previous successful purchase.')
    ).toBeOnTheScreen();
  });

  it('calls handleSelectBeneficiary when a beneficiary is selected during repeat payment', () => {
    const handleSelectBeneficiary =
      jest.fn<(beneficiary: UtilityBeneficiary) => void>();
    const beneficiary: UtilityBeneficiary = {
      id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
      customerId: '43901766923',
      customerName: 'JANE CUSTOMER',
      billerId: 'EKEDC_NG',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'EKEDC_PREPAID',
      lastUsed: 1000,
    };

    render(
      <BillItemSelectionSection
        beneficiaries={[beneficiary]}
        billItemSelection={billItemSelection}
        colors={Colors.light}
        customerId="43901766923"
        handleBillItemSelect={jest.fn<
          (depth: number, billItem: BillItem) => void
        >()}
        handleSelectBeneficiary={handleSelectBeneficiary}
        handleVerify={jest.fn()}
        isBillItemSelectionComplete={true}
        isRepeatPaymentActive={true}
        verifiedCustomerName="JANE CUSTOMER"
        selectedBillItemIdentifier="EKEDC_PREPAID"
        selectedBillerId="EKEDC_NG"
        setCustomerId={jest.fn()}
        setIsRepeatPaymentActive={jest.fn()}
        type="power"
        verify={createVerifyState({})}
      />
    );

    expect(
      screen.getByText('Using details from your previous successful purchase.')
    ).toBeOnTheScreen();

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Select JANE CUSTOMER, Meter Number 43901766923',
      })
    );

    expect(handleSelectBeneficiary).toHaveBeenCalledWith(beneficiary);
    expect(handleSelectBeneficiary).toHaveBeenCalledTimes(1);
  });

  it('renders recent recipients under the customer identifier field', async () => {
    const user = userEvent.setup();
    const onSelectRecentRecipient = jest.fn();

    render(
      <BillItemSelectionSection
        {...defaultProps}
        recentRecipients={[recentRecipient]}
        onSelectRecentRecipient={onSelectRecentRecipient}
      />
    );

    expect(screen.getByText('Select Beneficiary')).toBeOnTheScreen();
    expect(screen.getByText('Meter Number: 43901766923')).toBeOnTheScreen();

    await user.press(
      screen.getByLabelText('Select JANE CUSTOMER, Meter Number 43901766923')
    );

    expect(onSelectRecentRecipient).toHaveBeenCalledWith(recentRecipient);
  });

  it('dedupes saved bill beneficiaries already present in recent recipients', () => {
    const sharedId = '43901766923';
    const uniqueId = '43901766924';
    const beneficiaries: UtilityBeneficiary[] = [
      {
        id: `EKEDC_NG:EKEDC_PREPAID:${sharedId}`,
        customerId: sharedId,
        customerName: 'JANE CUSTOMER',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_PREPAID',
        lastUsed: 1000,
      },
      {
        id: `EKEDC_NG:EKEDC_PREPAID:${uniqueId}`,
        customerId: uniqueId,
        customerName: 'JOHN CUSTOMER',
        billerId: 'EKEDC_NG',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'EKEDC_PREPAID',
        lastUsed: 1000,
      },
    ];

    render(
      <BillItemSelectionSection
        {...defaultProps}
        beneficiaries={beneficiaries}
        recentRecipients={[recentRecipient]}
      />
    );

    expect(screen.getAllByText(new RegExp(sharedId))).toHaveLength(1);
    expect(screen.getByText(`Meter Number: ${uniqueId}`)).toBeOnTheScreen();
  });
});
