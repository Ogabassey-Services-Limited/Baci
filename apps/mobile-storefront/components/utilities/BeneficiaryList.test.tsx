import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';
import { BeneficiaryList } from './BeneficiaryList';

const colors = Colors.light;

const BENEFICIARY_A: UtilityBeneficiary = {
  id: 'EKEDC_NG:EKEDC_PREPAID:43901766923',
  customerId: '43901766923',
  customerName: 'OLUROTIMI ADEBANJO',
  billerId: 'EKEDC_NG',
  billerName: 'EKEDC NG',
  billItemIdentifier: 'EKEDC_PREPAID',
  lastUsed: 1000,
};

const BENEFICIARY_B: UtilityBeneficiary = {
  id: 'EKEDC_NG:EKEDC_PREPAID:43901577981',
  customerId: '43901577981',
  customerName: 'OLADIMEJI OLUROTIMI',
  billerId: 'EKEDC_NG',
  billerName: 'EKEDC NG',
  billItemIdentifier: 'EKEDC_PREPAID',
  lastUsed: 2000,
};

describe('BeneficiaryList', () => {
  it('renders nothing when beneficiaries list is empty', () => {
    const { toJSON } = render(
      <BeneficiaryList
        beneficiaries={[]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders beneficiary rows with name and meter number', () => {
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_A, BENEFICIARY_B]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('OLUROTIMI ADEBANJO')).toBeOnTheScreen();
    expect(screen.getByText('Meter Number: 43901766923')).toBeOnTheScreen();
    expect(screen.getByText('OLADIMEJI OLUROTIMI')).toBeOnTheScreen();
    expect(screen.getByText('Meter Number: 43901577981')).toBeOnTheScreen();
  });

  it('calls onSelect with the correct beneficiary when a row is pressed', () => {
    const onSelect = jest.fn();
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_A, BENEFICIARY_B]}
        colors={colors}
        onSelect={onSelect}
      />
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Select OLUROTIMI ADEBANJO, Meter Number 43901766923',
      })
    );
    expect(onSelect).toHaveBeenCalledWith(BENEFICIARY_A);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows initials avatar derived from customer name', () => {
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_A]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText('OA')).toBeOnTheScreen();
  });

  it('shows "Select Beneficiary" label', () => {
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_A]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText('Select Beneficiary')).toBeOnTheScreen();
  });

  it('renders a long customer name without crashing', () => {
    const longNameBeneficiary: UtilityBeneficiary = {
      id: 'EKEDC_NG:EKEDC_PREPAID:11111111111',
      customerId: '11111111111',
      customerName: 'ADEWALE OLANREWAJU OLUSANYA ADEBIMPE OLATUNJI BABATUNDE',
      billerId: 'EKEDC_NG',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'EKEDC_PREPAID',
      lastUsed: 500,
    };
    render(
      <BeneficiaryList
        beneficiaries={[longNameBeneficiary]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    expect(
      screen.getByText(longNameBeneficiary.customerName)
    ).toBeOnTheScreen();
  });

  it('renders names with Unicode and special characters', () => {
    const unicodeBeneficiary: UtilityBeneficiary = {
      id: 'EKEDC_NG:EKEDC_PREPAID:22222222222',
      customerId: '22222222222',
      customerName: "OLUṢừGUN ADEBÁYỌ",
      billerId: 'EKEDC_NG',
      billerName: 'EKEDC NG',
      billItemIdentifier: 'EKEDC_PREPAID',
      lastUsed: 3000,
    };
    render(
      <BeneficiaryList
        beneficiaries={[unicodeBeneficiary]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText(unicodeBeneficiary.customerName.toUpperCase())).toBeOnTheScreen();
    expect(
      screen.getByText(`Meter Number: ${unicodeBeneficiary.customerId}`)
    ).toBeOnTheScreen();
  });

  it('renders beneficiaries in the order they are provided (most recent first)', () => {
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_B, BENEFICIARY_A]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveProp(
      'accessibilityLabel',
      'Select OLADIMEJI OLUROTIMI, Meter Number 43901577981'
    );
    expect(buttons[1]).toHaveProp(
      'accessibilityLabel',
      'Select OLUROTIMI ADEBANJO, Meter Number 43901766923'
    );
  });

  it('renders a single beneficiary with correct button label, initials, and selection callback', () => {
    const onSelect = jest.fn<(beneficiary: UtilityBeneficiary) => void>();
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_A]}
        colors={colors}
        onSelect={onSelect}
      />
    );
    const btn = screen.getByRole('button', {
      name: 'Select OLUROTIMI ADEBANJO, Meter Number 43901766923',
    });
    expect(btn).toBeOnTheScreen();
    expect(screen.getByText('OA')).toBeOnTheScreen();
    fireEvent.press(btn);
    expect(onSelect).toHaveBeenCalledWith(BENEFICIARY_A);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
