import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { UtilityReceiptCard } from './UtilityReceiptCard';

function makeTransaction(
  overrides: Partial<VTUHistoryTransaction> = {}
): VTUHistoryTransaction {
  return {
    id: 'tx-1',
    created_at: '2026-06-24T17:56:37.000Z',
    type: 'airtime',
    status: 'successful',
    amount: 100,
    request_reference: 'VTU-123',
    network_provider: 'MTN',
    phone_number: '09169449282',
    ...overrides,
  } as VTUHistoryTransaction;
}

describe('UtilityReceiptCard', () => {
  it('shows the network, type, detail and amount', () => {
    render(
      <UtilityReceiptCard
        transaction={makeTransaction()}
        colors={Colors.light}
        onView={jest.fn()}
      />
    );

    expect(screen.getByText('MTN · Airtime')).toBeOnTheScreen();
    expect(screen.getByText(/09169449282/)).toBeOnTheScreen();
    expect(screen.getByText('₦100')).toBeOnTheScreen();
    expect(screen.getByText('View receipt')).toBeOnTheScreen();
  });

  it('calls onView with the transaction when pressed', () => {
    const onView = jest.fn();
    const transaction = makeTransaction();

    render(
      <UtilityReceiptCard
        transaction={transaction}
        colors={Colors.light}
        onView={onView}
      />
    );

    fireEvent.press(screen.getByLabelText('Airtime receipt for MTN'));
    expect(onView).toHaveBeenCalledWith(transaction);
  });

  it('falls back to the biller name for electricity receipts', () => {
    render(
      <UtilityReceiptCard
        transaction={makeTransaction({
          type: 'electricity',
          status: 'pending',
          network_provider: null,
          biller_name: 'Ikeja Electric',
          phone_number: null,
          customer_identifier: '45701572427',
        })}
        colors={Colors.light}
        onView={jest.fn()}
      />
    );

    expect(screen.getByText('Ikeja Electric · Electricity')).toBeOnTheScreen();
    expect(screen.getByText(/45701572427/)).toBeOnTheScreen();
    expect(screen.getByText('Pending')).toBeOnTheScreen();
  });
});
