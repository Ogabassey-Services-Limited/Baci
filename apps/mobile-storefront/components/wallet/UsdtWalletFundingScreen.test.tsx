import { describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { createUsdtWalletFundingClient } from '@/lib/usdt-wallet-funding-client';

type UsdtFundingClient = ReturnType<typeof createUsdtWalletFundingClient>;

const mockBalance = jest.fn<UsdtFundingClient['balance']>();
const mockInitialize = jest.fn<UsdtFundingClient['initialize']>();
const mockStatus = jest.fn<UsdtFundingClient['status']>();
jest.mock('@/lib/usdt-wallet-funding-client', () => ({
  createUsdtWalletFundingClient: () => ({
    balance: mockBalance,
    initialize: mockInitialize,
    status: mockStatus,
  }),
}));
jest.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: jest.fn() }),
}));
jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));
jest.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  __esModule: true,
}));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

import { UsdtWalletFundingScreen } from './UsdtWalletFundingScreen';

describe('UsdtWalletFundingScreen', () => {
  it('shows balance and creates a chain-specific deposit address', async () => {
    mockBalance.mockResolvedValue(12.5);
    mockInitialize.mockResolvedValue({
      address: 'TVaultAddress',
      kind: 'ready',
      reference: 'wusdt_ref',
    });
    mockStatus.mockResolvedValue({ fundingStatus: 'pending', kind: 'ready' });
    render(
      <UsdtWalletFundingScreen
        accessToken="token"
        apiBaseUrl="https://shop.example.com"
        initialAmount={65}
        merchantSlug="ogabassey"
      />
    );

    expect(await screen.findByText('12.50 USDT')).toBeTruthy();
    fireEvent.changeText(
      screen.getByLabelText('Address line'),
      '1 Baci Street'
    );
    fireEvent.changeText(screen.getByLabelText('City'), 'Lagos');
    fireEvent.changeText(screen.getByLabelText('Postal code'), '100001');
    fireEvent.press(
      screen.getByRole('button', { name: /create deposit address/i })
    );

    await waitFor(() =>
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 65, chain: 'TRX' })
      )
    );
    expect(await screen.findByText('TVaultAddress')).toBeTruthy();
  });
});
