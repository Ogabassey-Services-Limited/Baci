import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({ amount: '65' }),
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
    selector({ customer: {}, session: { access_token: 'token' } }),
}));

import UsdtWalletFundingRoute from '@/app/wallet/usdt';

describe('UsdtWalletFundingRoute', () => {
  it('forwards a bounded deep-linked USDT amount', () => {
    render(<UsdtWalletFundingRoute />);
    expect(screen.getByText('Fund 65 USDT')).toBeTruthy();
  });
});
