import { afterEach, jest } from '@jest/globals';
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

  return {
    __esModule: true,
    default: { View },
    FadeIn: {},
  };
});

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { session: null }) => unknown) =>
    selector({ session: null }),
}));

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: (text: string) => mockSetClipboardString(text),
}));

jest.mock('@/lib/utility-receipt', () => ({
  shareUtilityReceipt: (input: unknown) => mockShareUtilityReceipt(input),
}));

describe('PurchaseSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetClipboardString.mockResolvedValue(true);
    mockShareUtilityReceipt.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
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

  it('copies a returned electricity token and shares the receipt', async () => {
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
});
