import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { BillItem } from '@/hooks/use-vtu-billers';
import { DataPlanSelectionSection } from './DataPlanSelectionSection';

const billItems: BillItem[] = [
  {
    amount: 1000,
    isAmountFixed: true,
    itemCode: 'MTN-1GB-MONTHLY',
    itemCurrencySymbol: 'NGN',
    itemFee: 0,
    itemName: 'MTN 1GB Monthly',
  },
  {
    amount: 3500,
    isAmountFixed: true,
    itemCode: 'MTN-35GB-MONTHLY',
    itemCurrencySymbol: 'NGN',
    itemFee: 0,
    itemName: 'MTN 3.5GB Monthly',
  },
];

describe('DataPlanSelectionSection', () => {
  it('renders fixed-price data packages and calls onSelectPlan with the item code', () => {
    const onSelectPlan = jest.fn();

    render(
      <DataPlanSelectionSection
        billItems={billItems}
        colors={Colors.light}
        selectedPlan="MTN-1GB-MONTHLY"
        onSelectPlan={onSelectPlan}
      />
    );

    expect(screen.getByText('Select Data Package')).toBeOnTheScreen();
    expect(screen.getByText('MTN 3.5GB Monthly')).toBeOnTheScreen();
    expect(screen.getByText('₦3,500')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('MTN 3.5GB Monthly - ₦3,500'));

    expect(onSelectPlan).toHaveBeenCalledWith(
      expect.objectContaining({ itemCode: 'MTN-35GB-MONTHLY' })
    );
  });
});
