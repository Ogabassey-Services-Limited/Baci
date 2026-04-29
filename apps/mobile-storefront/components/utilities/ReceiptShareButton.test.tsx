import { jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Colors from '@/constants/Colors';
import { shareUtilityReceipt } from '@/lib/utility-receipt';
import ReceiptShareButton from './ReceiptShareButton';

jest.mock('@/lib/utility-receipt', () => ({
  shareUtilityReceipt: jest.fn(),
}));

const mockShareUtilityReceipt = jest.mocked(shareUtilityReceipt);

describe('ReceiptShareButton', () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockShareUtilityReceipt.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shares receipts when a transaction reference is available', async () => {
    render(
      <ReceiptShareButton
        amount={1000}
        colors={Colors.light}
        identifier="08012345678"
        status="successful"
        txReference="VTU-123"
        type="airtime"
      />
    );

    fireEvent.press(screen.getByLabelText('Share utility receipt'));

    await waitFor(() => {
      expect(mockShareUtilityReceipt).toHaveBeenCalledWith({
        amount: 1000,
        customerIdentifier: '08012345678',
        reference: 'VTU-123',
        status: 'successful',
        type: 'airtime',
        voucherPin: undefined,
      });
    });
  });

  it('does not share receipts without a transaction reference', async () => {
    render(
      <ReceiptShareButton
        amount={1000}
        colors={Colors.light}
        identifier="08012345678"
        status="successful"
        txReference={null}
        type="airtime"
      />
    );

    fireEvent.press(screen.getByLabelText('Share utility receipt'));

    expect(mockShareUtilityReceipt).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Receipt Unavailable',
      'A transaction reference is required before sharing this receipt.'
    );
  });
});
