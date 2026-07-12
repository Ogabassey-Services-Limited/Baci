import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

let mockSearchParams: Record<string, string | undefined> = { amount: '65' };
let mockAuthState: {
  customer: Record<string, unknown>;
  session: { access_token: string } | null;
} = { customer: {}, session: { access_token: 'token' } };

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return <Text>{`Redirect:${href}`}</Text>;
  },
  useLocalSearchParams: () => mockSearchParams,
}));
jest.mock('@/components/wallet/UsdtWalletFundingScreen', () => ({
  UsdtWalletFundingScreen: ({ initialAmount }: { initialAmount?: number }) => {
    const { Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return <Text>{`Fund ${initialAmount} USDT`}</Text>;
  },
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthState),
}));

import UsdtWalletFundingRoute from '@/app/wallet/usdt';

describe('UsdtWalletFundingRoute', () => {
  beforeEach(() => {
    mockSearchParams = { amount: '65' };
    mockAuthState = { customer: {}, session: { access_token: 'token' } };
  });

  it('forwards a bounded deep-linked USDT amount', () => {
    render(<UsdtWalletFundingRoute />);
    expect(screen.getByText('Fund 65 USDT')).toBeTruthy();
  });

  it('preserves funding params through the login redirect', () => {
    mockSearchParams = { amount: '65', returnTo: '/imei-check' };
    mockAuthState = { customer: {}, session: null };

    render(<UsdtWalletFundingRoute />);

    expect(
      screen.getByText(
        'Redirect:/auth/login?returnTo=%2Fwallet%2Fusdt%3Famount%3D65%26returnTo%3D%252Fimei-check'
      )
    ).toBeTruthy();
  });
});
