import { describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { Alert } from 'react-native';

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const mockWalletRefetch = jest.fn();
let mockWalletBalance = 5000;
let mockWalletIsError = false;
let mockWalletIsLoading = false;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy.mockClear();
  mockWalletBalance = 5000;
  mockWalletIsError = false;
  mockWalletIsLoading = false;
  mockWalletRefetch.mockClear();
  global.fetch = jest.fn() as typeof fetch;
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));

jest.mock('@/components/ui/AppKeyboardContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: jest.fn() }),
}));

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    data: { wallet: { balance: mockWalletBalance } },
    isError: mockWalletIsError,
    isLoading: mockWalletIsLoading,
    refetch: mockWalletRefetch,
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ session: { access_token: 'token-123' } }),
}));

import ImeiCheckerScreen from '@/app/imei-check';

describe('ImeiCheckerScreen', () => {
  it('renders primary shared service tiers with Full Report selected', () => {
    render(<ImeiCheckerScreen />);

    expect(screen.getByText('Full Report')).toBeTruthy();
    expect(screen.getByText('Non-Active Status PRO')).toBeTruthy();
    expect(screen.getByText('Stolen Check')).toBeTruthy();
    expect(screen.getByText('Network Check')).toBeTruthy();
    expect(screen.getByText('Verify Now - ₦1,500')).toBeTruthy();
  });

  it('updates the CTA price when a different service tier is selected', () => {
    render(<ImeiCheckerScreen />);

    fireEvent.press(screen.getByText('Non-Active Status PRO'));

    expect(screen.getByText('Verify Now - ₦700')).toBeTruthy();
  });

  it('hides the services toggle when no additional public tiers are available', () => {
    render(<ImeiCheckerScreen />);

    expect(screen.queryByText('Show all services')).toBeNull();
    fireEvent.press(screen.getByText('Samsung'));

    expect(screen.queryByText('Samsung Info PRO')).toBeNull();
  });

  it('alerts the user and skips the request when an invalid IMEI is submitted', () => {
    render(<ImeiCheckerScreen />);

    const input = screen.getByPlaceholderText('Enter 15-digit IMEI');
    // 15 digits, but the Luhn checksum is invalid so isValidIMEI() returns false.
    fireEvent.changeText(input, '123456789012345');
    fireEvent(input, 'submitEditing');

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid IMEI',
      expect.stringContaining('valid 15-digit IMEI')
    );
  });

  it('waits for wallet balance before enabling verification', () => {
    mockWalletIsLoading = true;
    render(<ImeiCheckerScreen />);

    const input = screen.getByPlaceholderText('Enter 15-digit IMEI');
    expect(screen.getByText('Loading wallet balance...')).toBeTruthy();
    fireEvent.changeText(input, '490154203237518');
    fireEvent.press(screen.getByText('Loading wallet...'));
    fireEvent(input, 'submitEditing');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('routes to wallet top-up instead of requesting when keyboard submit has insufficient balance', () => {
    mockWalletBalance = 500;
    render(<ImeiCheckerScreen />);

    const input = screen.getByPlaceholderText('Enter 15-digit IMEI');
    fireEvent.changeText(input, '490154203237518');
    fireEvent(input, 'submitEditing');

    expect(fetch).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/wallet?action=fund&requiredAmount=1000&returnTo=/imei-check'
    );
  });

  it('routes unauthenticated customers to login on 401', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          code: 'AUTH_REQUIRED',
          error: 'Unauthorized',
          success: false,
        }),
      ok: false,
      status: 401,
    } as Response);
    render(<ImeiCheckerScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter 15-digit IMEI'),
      '490154203237518'
    );
    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        '/auth/login?returnTo=/imei-check'
      );
    });
  });

  it('routes to wallet top-up with the required delta on 402', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          balance: 500,
          code: 'WALLET_INSUFFICIENT',
          error: 'Insufficient wallet balance',
          required: 1500,
          success: false,
        }),
      ok: false,
      status: 402,
    } as Response);
    render(<ImeiCheckerScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter 15-digit IMEI'),
      '490154203237518'
    );
    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        '/wallet?action=fund&requiredAmount=1000&returnTo=/imei-check'
      );
    });
  });

  it('falls back to finite values when 402 balance payload is malformed', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          balance: 'not-a-number',
          code: 'WALLET_INSUFFICIENT',
          error: 'Insufficient wallet balance',
          required: 'not-a-number',
          success: false,
        }),
      ok: false,
      status: 402,
    } as Response);
    render(<ImeiCheckerScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter 15-digit IMEI'),
      '490154203237518'
    );
    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        '/wallet?action=fund&requiredAmount=0&returnTo=/imei-check'
      );
    });
  });

  it('shows delayed refund copy and refreshes wallet on REFUND_PENDING', async () => {
    jest.mocked(fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({
          code: 'REFUND_PENDING',
          error: 'Refund pending',
          success: false,
        }),
      ok: false,
      status: 502,
    } as Response);
    render(<ImeiCheckerScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter 15-digit IMEI'),
      '490154203237518'
    );
    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Lookup failed; your refund is pending. We will credit you within 24h.'
        )
      ).toBeTruthy();
    });
    expect(mockWalletRefetch).toHaveBeenCalled();

    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    const firstHeaders = (jest.mocked(fetch).mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    const secondHeaders = (jest.mocked(fetch).mock.calls[1][1] as RequestInit)
      .headers as Record<string, string>;

    expect(secondHeaders['Idempotency-Key']).toBe(
      firstHeaders['Idempotency-Key']
    );
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'DEBIT_FAILURE_STATE_SAVE_FAILED',
      'Lookup failed and debit failure state could not be saved.',
    ],
    [
      'LOOKUP_RESULT_SAVE_FAILED',
      'IMEI lookup completed but the result could not be saved.',
    ],
    [
      'REFUND_STATE_SAVE_FAILED',
      'Lookup failed and refund status could not be saved.',
    ],
    [
      'REFUNDED_STATE_SAVE_FAILED',
      'Lookup failed and refund result could not be saved.',
    ],
  ])('preserves the idempotency key after unresolved %s responses', async (code, error) => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    jest
      .mocked(fetch)
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            code,
            error,
            success: false,
          }),
        ok: false,
        status: 500,
      } as Response)
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            data: {
              blacklistStatus: 'Clean',
              carrier: 'Unlocked',
              device: 'iPhone 13 Pro',
              deviceImage: '',
              deviceType: 'apple',
              icloud: 'Off',
              icloudLock: 'Off',
              imei: '490154203237518',
              modelNumber: 'A2638',
              score: 98,
              simLock: 'Unlocked',
              status: 'Clean',
              verdict: 'Safe to buy',
              verdictType: 'safe',
            },
            success: true,
          }),
        ok: true,
        status: 200,
      } as Response);
    render(<ImeiCheckerScreen />);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter 15-digit IMEI'),
      '490154203237518'
    );
    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    await waitFor(() => {
      expect(screen.getByText(error)).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText('Verify Now - ₦1,500')).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Verify Now - ₦1,500'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    await screen.findByText('iPhone 13 Pro');

    const firstHeaders = (jest.mocked(fetch).mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>;
    const secondHeaders = (jest.mocked(fetch).mock.calls[1][1] as RequestInit)
      .headers as Record<string, string>;

    expect(secondHeaders['Idempotency-Key']).toBe(
      firstHeaders['Idempotency-Key']
    );
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
  });
});
