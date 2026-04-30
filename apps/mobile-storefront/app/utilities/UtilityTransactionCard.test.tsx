import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors, { withAlpha } from '@/constants/Colors';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import {
  UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS,
  UTILITY_HISTORY_STYLE_TOKENS,
} from './history.constants';
import UtilityTransactionCard from './UtilityTransactionCard';

function createTransaction(
  overrides: Partial<VTUHistoryTransaction> = {}
): VTUHistoryTransaction {
  return {
    amount: 2500,
    biller_name: 'EKEDC NG',
    created_at: '2026-04-08T12:00:00.000Z',
    customer_cashback: 100,
    customer_identifier: '1234567890',
    customer_name: 'Jane Customer',
    id: 'tx-1',
    payment_gateway: 'paystack',
    payment_reference: 'PAY-123',
    payment_status: 'completed',
    request_reference: 'VTU-123',
    status: 'successful',
    type: 'electricity',
    voucher_pin: '1234-5678',
    ...overrides,
  };
}

function renderCard(
  transaction: VTUHistoryTransaction,
  overrides: Partial<{
    handleCopyVoucher: (voucherPin: string) => void;
    handleRepeatTransaction: (transaction: VTUHistoryTransaction) => void;
    handleShareReceipt: (transaction: VTUHistoryTransaction) => void;
    handleSyncPayment: (transaction: VTUHistoryTransaction) => void;
    sharingTransactionId: string | null;
    syncingTransactionId: string | null;
  }> = {}
) {
  const props = {
    colors: Colors.light,
    handleCopyVoucher: jest.fn(),
    handleRepeatTransaction: jest.fn(),
    handleShareReceipt: jest.fn(),
    handleSyncPayment: jest.fn(),
    sharingTransactionId: null,
    syncingTransactionId: null,
    transaction,
    ...overrides,
  };

  const renderResult = render(<UtilityTransactionCard {...props} />);

  return { ...props, ...renderResult };
}

function createCardElement(
  transaction: VTUHistoryTransaction,
  overrides: Partial<{
    handleCopyVoucher: (voucherPin: string) => void;
    handleRepeatTransaction: (transaction: VTUHistoryTransaction) => void;
    handleShareReceipt: (transaction: VTUHistoryTransaction) => void;
    handleSyncPayment: (transaction: VTUHistoryTransaction) => void;
    sharingTransactionId: string | null;
    syncingTransactionId: string | null;
  }> = {}
) {
  return (
    <UtilityTransactionCard
      colors={Colors.light}
      handleCopyVoucher={jest.fn()}
      handleRepeatTransaction={jest.fn()}
      handleShareReceipt={jest.fn()}
      handleSyncPayment={jest.fn()}
      sharingTransactionId={null}
      syncingTransactionId={null}
      transaction={transaction}
      {...overrides}
    />
  );
}

describe('UtilityTransactionCard', () => {
  it('renders a successful token purchase and wires card actions', () => {
    const transaction = createTransaction();
    const props = renderCard(transaction);

    expect(screen.getByText('EKEDC NG')).toBeOnTheScreen();
    expect(screen.getByText('Power • 1234567890')).toBeOnTheScreen();
    expect(screen.getByText('Voucher / Token')).toBeOnTheScreen();
    expect(screen.getByText('1234-5678')).toBeOnTheScreen();
    expect(screen.getByText(/Cashback:/)).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Copy voucher token'));
    fireEvent.press(screen.getByLabelText('Repeat EKEDC NG'));
    fireEvent.press(screen.getByLabelText('Share receipt for EKEDC NG'));

    expect(props.handleCopyVoucher).toHaveBeenCalledWith('1234-5678');
    expect(props.handleRepeatTransaction).toHaveBeenCalledWith(transaction);
    expect(props.handleShareReceipt).toHaveBeenCalledWith(transaction);
  });

  it('shows sync actions for gateway payments that still need fulfillment', () => {
    const transaction = createTransaction({
      customer_cashback: null,
      status: 'failed',
      voucher_pin: null,
    });
    const props = renderCard(transaction);

    expect(screen.queryByText('Repeat')).toBeNull();
    expect(screen.getByText('Payment Received')).toHaveStyle({
      color: UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS.color,
    });
    expect(screen.getByLabelText('Payment Received status')).toHaveStyle({
      backgroundColor: withAlpha(
        UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS.color,
        UTILITY_HISTORY_STYLE_TOKENS.statusTintOpacity
      ),
    });
    expect(
      screen.getByText(
        'Payment received. Tap Sync payment to retry bill fulfillment.'
      )
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Sync payment for EKEDC NG'));

    expect(props.handleSyncPayment).toHaveBeenCalledWith(transaction);
  });

  it('falls back when transaction type is unknown at runtime', () => {
    renderCard(
      createTransaction({
        biller_name: null,
        customer_identifier: null,
        customer_name: null,
        type: 'voucher' as unknown as VTUHistoryTransaction['type'],
      })
    );

    expect(screen.getByText('Utility payment')).toBeOnTheScreen();
    expect(
      screen.getByText('Unknown transaction • Customer identifier unavailable')
    ).toBeOnTheScreen();
  });

  it('disables share and sync buttons while their actions are pending', () => {
    const transaction = createTransaction();

    const { rerender } = renderCard(transaction, {
      sharingTransactionId: 'tx-1',
    });

    expect(screen.getByText('Sharing...')).toBeOnTheScreen();
    expect(screen.getByLabelText('Share receipt for EKEDC NG')).toBeDisabled();

    rerender(
      createCardElement(
        createTransaction({
          status: 'failed',
          voucher_pin: null,
        }),
        { syncingTransactionId: 'tx-1' }
      )
    );

    expect(screen.getByText('Syncing...')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sync payment for EKEDC NG')).toBeDisabled();
  });
});
