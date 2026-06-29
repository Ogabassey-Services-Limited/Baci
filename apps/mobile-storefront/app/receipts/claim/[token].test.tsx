import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import ReceiptClaimScreen from './[token]';

const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseRequireAuth = jest.fn();
const mockGetSession = jest.fn();
const mockFetch = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect:{href}</Text>;
  },
  router: {
    replace: (...args: Parameters<typeof mockReplace>) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/receipts/receipt-claim-status-card', () => ({
  ReceiptClaimStatusCard: ({ message }: { message: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{message}</Text>;
  },
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({ children }: { children?: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/constants/Colors', () => ({
  __esModule: true,
  default: {
    light: {
      background: '#ffffff',
      text: '#111827',
      textSecondary: '#6b7280',
      tint: '#dc2626',
    },
  },
}));

jest.mock('@/env', () => ({
  EXPO_PUBLIC_API_URL: 'https://example.com',
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/lib/supabase', () => ({
  getSession: () => mockGetSession(),
}));

function renderClaimScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReceiptClaimScreen />
    </QueryClientProvider>
  );
}

describe('ReceiptClaimScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockUseLocalSearchParams.mockReturnValue({ token: 'claim-token' });
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
    });
    mockGetSession.mockResolvedValue({ access_token: 'access-token' });
    mockFetch.mockResolvedValue({
      json: async () => ({ redirectPath: '/receipts' }),
      ok: true,
    });
  });

  it('redeems the token and marks the receipts arrival as a claim success', async () => {
    renderClaimScreen();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/storefront/receipts/claims/claim-token',
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer access-token',
          },
          method: 'POST',
        }
      );
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/receipts?receiptClaimed=1');
    });
  });
});
