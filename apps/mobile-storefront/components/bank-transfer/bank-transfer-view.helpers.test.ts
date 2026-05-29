import { jest } from '@jest/globals';
import {
  formatTransferAmount,
  getDisplayStatusCopy,
  getWalletFundingStatusCopy,
} from './bank-transfer-view.helpers';

jest.mock('@/stores/cart-store', () => ({
  formatPrice: (amount: number) => `TEST ${amount.toLocaleString('en-US')}`,
}));

describe('bank transfer view helpers', () => {
  it('formats valid transfer amounts and rejects malformed values', () => {
    expect(formatTransferAmount('20000')).toBe('TEST 20,000');
    expect(formatTransferAmount('not-a-number')).toBeNull();
    expect(formatTransferAmount()).toBeNull();
  });

  it('uses timed-out wallet copy only while the wallet status is non-terminal', () => {
    expect(
      getDisplayStatusCopy({
        pollingTimedOut: true,
        walletFundingStatus: 'pending',
      })
    ).toEqual({
      icon: 'refresh-circle-outline',
      message: 'Tap check payment status to refresh, or contact support.',
      title: 'Auto-check stopped',
    });
    expect(
      getDisplayStatusCopy({
        pollingTimedOut: true,
        remainingAmount: 3500,
        walletFundingStatus: 'underfunded',
      })
    ).toEqual({
      icon: 'alert-circle-outline',
      message: 'TEST 3,500 still needed',
      title: 'Transfer remaining amount',
    });
    expect(
      getDisplayStatusCopy({
        pollingTimedOut: true,
        walletFundingStatus: 'completed',
      })
    ).toEqual({
      icon: 'checkmark-circle-outline',
      message: 'Your wallet funded this order successfully.',
      title: 'Payment confirmed',
    });
  });

  it('describes underfunded wallet-funded payments with the remaining amount', () => {
    expect(
      getWalletFundingStatusCopy({
        remainingAmount: 3500,
        status: 'underfunded',
      })
    ).toEqual({
      icon: 'alert-circle-outline',
      message: 'TEST 3,500 still needed',
      title: 'Transfer remaining amount',
    });
    expect(getWalletFundingStatusCopy({ status: 'underfunded' })).toEqual({
      icon: 'alert-circle-outline',
      message:
        'Additional payment is needed, but we could not confirm the exact amount. Please add funds or contact support.',
      title: 'Additional payment needed',
    });
  });

  it('describes review, terminal, failed, and completed wallet-funded states', () => {
    expect(
      getWalletFundingStatusCopy({
        orderNumber: 'ORD-1',
        status: 'review_required',
      })
    ).toEqual({
      icon: 'help-circle-outline',
      message: 'Support is reviewing payment for order ORD-1.',
      title: 'Transfer under review',
    });
    expect(getWalletFundingStatusCopy({ status: 'expired' })).toEqual({
      icon: 'time-outline',
      message: 'Please restart checkout to generate fresh payment details.',
      title: 'Payment window expired',
    });
    expect(getWalletFundingStatusCopy({ status: 'failed' })).toEqual({
      icon: 'close-circle-outline',
      message:
        'Unable to process this payment. Please contact support or try again.',
      title: 'Payment failed',
    });
    expect(getWalletFundingStatusCopy({ status: 'completed' })).toEqual({
      icon: 'checkmark-circle-outline',
      message: 'Your wallet funded this order successfully.',
      title: 'Payment confirmed',
    });
    expect(getWalletFundingStatusCopy({ status: 'pending' })).toBeNull();
  });

  it('uses expired copy for cancelled wallet-funded payments', () => {
    expect(getWalletFundingStatusCopy({ status: 'cancelled' })).toEqual({
      icon: 'time-outline',
      message: 'Please restart checkout to generate fresh payment details.',
      title: 'Payment window expired',
    });
  });

  it('falls back to this order for review copy without an order number', () => {
    expect(getWalletFundingStatusCopy({ status: 'review_required' })).toEqual({
      icon: 'help-circle-outline',
      message: 'Support is reviewing payment for this order.',
      title: 'Transfer under review',
    });
  });
});
