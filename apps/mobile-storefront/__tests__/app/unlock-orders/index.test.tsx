import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return <Text>{href}</Text>;
  },
}));
jest.mock('@/components/imei-check/unlock-orders-screen', () => ({
  UnlockOrdersScreen: ({ accessToken }: { accessToken: string }) => {
    const { Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return <Text>{`Unlock orders with ${accessToken}`}</Text>;
  },
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ session: { access_token: 'token-123' } }),
}));

import UnlockOrdersRoute from '@/app/unlock-orders';

describe('UnlockOrdersRoute', () => {
  it('passes the authenticated session into the customer tracker', () => {
    render(<UnlockOrdersRoute />);
    expect(screen.getByText('Unlock orders with token-123')).toBeTruthy();
  });
});
