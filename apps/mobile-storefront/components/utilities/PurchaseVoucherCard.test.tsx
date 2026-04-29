import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Colors from '@/constants/Colors';
import { setClipboardString } from '@/lib/clipboard';
import PurchaseVoucherCard from './PurchaseVoucherCard';

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: jest.fn(),
}));

const mockSetClipboardString = jest.mocked(setClipboardString);

describe('PurchaseVoucherCard', () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetClipboardString.mockResolvedValue(true);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('copies voucher tokens from the card', async () => {
    render(<PurchaseVoucherCard colors={Colors.light} voucherPin="1234-5678" />);

    fireEvent.press(screen.getByLabelText('Copy voucher token'));

    expect(mockSetClipboardString).toHaveBeenCalledWith('1234-5678');
    await screen.findByText('Voucher / Token');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Copied',
      'Token copied to clipboard.'
    );
  });

  it('reports copy errors without exposing the token', async () => {
    mockSetClipboardString.mockRejectedValueOnce(new Error('copy failed'));

    render(<PurchaseVoucherCard colors={Colors.light} voucherPin="1234-5678" />);

    fireEvent.press(screen.getByLabelText('Copy voucher token'));

    await screen.findByText('Voucher / Token');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to copy utility voucher token:',
      expect.any(Error)
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Copy Failed',
      'Could not copy this token.'
    );
  });
});
