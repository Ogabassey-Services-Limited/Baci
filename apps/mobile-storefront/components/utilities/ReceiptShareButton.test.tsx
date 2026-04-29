import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
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
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockShareUtilityReceipt.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
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

  it('does not share receipts without a transaction reference', () => {
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

    const shareButton = screen.getByLabelText('Share utility receipt');

    expect(shareButton).toBeDisabled();
    fireEvent.press(shareButton);
    expect(mockShareUtilityReceipt).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('reports share failures', async () => {
    mockShareUtilityReceipt.mockRejectedValueOnce(new Error('Share failed'));

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
      expect(alertSpy).toHaveBeenCalledWith(
        'Share Failed',
        'Could not generate the receipt PDF. Please try again.'
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to share utility receipt:',
      expect.any(Error)
    );
  });
});
