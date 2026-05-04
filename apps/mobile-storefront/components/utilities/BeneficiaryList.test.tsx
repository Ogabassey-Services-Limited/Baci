import { fireEvent, render, screen } from '@testing-library/react-native';
import { describe, expect, it, vi } from 'vitest';
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
      <BeneficiaryList beneficiaries={[]} colors={colors} onSelect={vi.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders beneficiary rows with name and meter number', () => {
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_A, BENEFICIARY_B]}
        colors={colors}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('OLUROTIMI ADEBANJO')).toBeTruthy();
    expect(screen.getByText('Meter Number: 43901766923')).toBeTruthy();
    expect(screen.getByText('OLADIMEJI OLUROTIMI')).toBeTruthy();
    expect(screen.getByText('Meter Number: 43901577981')).toBeTruthy();
  });

  it('calls onSelect with the correct beneficiary when a row is pressed', () => {
    const onSelect = vi.fn();
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
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('OA')).toBeTruthy();
  });

  it('shows "Select Beneficiary" label', () => {
    render(
      <BeneficiaryList
        beneficiaries={[BENEFICIARY_A]}
        colors={colors}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Select Beneficiary')).toBeTruthy();
  });
});
