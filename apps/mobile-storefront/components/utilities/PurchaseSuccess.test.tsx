import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PurchaseSuccess } from '@/components/utilities/PurchaseSuccess';

const mockSetClipboardString = jest.fn<(text: string) => Promise<boolean>>();
const mockShareUtilityReceipt = jest.fn<(input: unknown) => Promise<void>>();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const FadeIn = {
    delay: jest.fn(() => FadeIn),
    duration: jest.fn(() => FadeIn),
  };

  return {
    __esModule: true,
    default: { View },
    FadeIn,
  };
});

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: (text: string) => mockSetClipboardString(text),
}));

jest.mock('@/lib/utility-receipt', () => ({
  shareUtilityReceipt: (input: unknown) => mockShareUtilityReceipt(input),
}));

jest.mock('@/services/analytics', () => ({
  trackError: jest.fn(),
}));

describe('PurchaseSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetClipboardString.mockResolvedValue(true);
    mockShareUtilityReceipt.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the meter number when a utility payment is still processing', () => {
    render(
      <PurchaseSuccess
        type="power"
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
        status="processing"
      />
    );

    expect(screen.getByText('Payment Received')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Your electricity payment for 43901766923 is processing. We will update your utility history shortly.'
      )
    ).toBeOnTheScreen();
  });

  it('shows a returned utility voucher token', () => {
    render(
      <PurchaseSuccess
        type="power"
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
        voucherPin="1234-5678-9012-3456"
      />
    );

    expect(screen.getByText('Voucher / Token')).toBeOnTheScreen();
    expect(screen.getByText('1234-5678-9012-3456')).toBeOnTheScreen();
  });

  it('copies a returned electricity token', async () => {
    render(
      <PurchaseSuccess
        type="power"
        amount={1000}
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
        voucherPin="1234-5678-9012-3456"
      />
    );

    fireEvent.press(screen.getByLabelText('Copy voucher token'));

    await waitFor(() => {
      expect(mockSetClipboardString).toHaveBeenCalledWith(
        '1234-5678-9012-3456'
      );
    });
  });

  it('shares a utility receipt with returned voucher details', async () => {
    render(
      <PurchaseSuccess
        type="power"
        amount={1000}
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
        voucherPin="1234-5678-9012-3456"
      />
    );

    fireEvent.press(screen.getByLabelText('Share utility receipt'));

    await waitFor(() => {
      expect(mockShareUtilityReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          customerIdentifier: '43901766923',
          reference: 'ref-123',
          type: 'power',
          voucherPin: '1234-5678-9012-3456',
        })
      );
    });
  });

  it('alerts when copying a returned electricity token fails', async () => {
    mockSetClipboardString.mockRejectedValueOnce(new Error('Clipboard denied'));

    render(
      <PurchaseSuccess
        type="power"
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
        voucherPin="1234-5678-9012-3456"
      />
    );

    fireEvent.press(screen.getByLabelText('Copy voucher token'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Copy Failed',
        'Could not copy this token.'
      );
    });
    expect(console.error).toHaveBeenCalledWith(
      'Failed to copy utility voucher token:',
      expect.any(Error)
    );
  });

  it('alerts when copying a returned electricity token is declined', async () => {
    mockSetClipboardString.mockResolvedValueOnce(false);

    render(
      <PurchaseSuccess
        type="power"
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
        voucherPin="1234-5678-9012-3456"
      />
    );

    fireEvent.press(screen.getByLabelText('Copy voucher token'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Copy Failed',
        'Could not copy this token.'
      );
    });
  });

  it('alerts when sharing the utility receipt fails', async () => {
    mockShareUtilityReceipt.mockRejectedValueOnce(
      new Error('PDF generation failed')
    );

    render(
      <PurchaseSuccess
        type="power"
        amount={1000}
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
        voucherPin="1234-5678-9012-3456"
      />
    );

    fireEvent.press(screen.getByLabelText('Share utility receipt'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Share Failed',
        'Could not generate the receipt PDF. Please try again.'
      );
    });
    expect(console.error).toHaveBeenCalledWith(
      'Failed to share utility receipt:',
      expect.any(Error)
    );
  });

  it('shows account creation CTA for unauthenticated users', () => {
    const onCreateAccount = jest.fn();

    render(
      <PurchaseSuccess
        type="power"
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={false}
        onCreateAccount={onCreateAccount}
      />
    );

    fireEvent.press(screen.getByText('Create Account'));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });

  it('shows cashback details when cashback is returned', () => {
    render(
      <PurchaseSuccess
        type="power"
        customerIdentifier="43901766923"
        txReference="ref-123"
        cashback={{ amount: 50, newBalance: 1200 }}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
      />
    );

    expect(screen.getByText('+₦50.00 cashback')).toBeOnTheScreen();
    expect(screen.getByText('Wallet balance: ₦1,200.00')).toBeOnTheScreen();
  });

  it('uses the provided utility type when no label mapping exists', () => {
    render(
      <PurchaseSuccess
        type="water"
        customerIdentifier="WATER-123"
        txReference="ref-123"
        cashback={null}
        isAuthenticated={true}
        onCreateAccount={jest.fn()}
      />
    );

    expect(
      screen.getByText('Your water purchase for WATER-123 was successful.')
    ).toBeOnTheScreen();
  });
});
