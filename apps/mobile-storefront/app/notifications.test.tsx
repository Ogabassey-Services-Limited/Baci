import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import NotificationsScreen from './notifications';

const mockFlashList = jest.fn(({ children, ...props }) => (
  <View testID="notifications-flash-list" {...props}>
    {children}
  </View>
));
const mockStorefrontScreenShell = jest.fn(({ children, ...props }) => (
  <View testID="storefront-screen-shell" {...props}>
    {children}
  </View>
));
const mockUseStorefrontInsets = jest.fn();
const mockUseRequireAuth = jest.fn();
const mockUseAuthStore = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: () => null,
  Stack: {
    Screen: () => null,
  },
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ children, ...props }: { children?: React.ReactNode }) =>
    mockFlashList({ children, ...props }),
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
  }) => mockStorefrontScreenShell({ children, ...props }),
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: jest.fn(),
      getListContentStyle: () => ({
        padding: 16,
        gap: 12,
      }),
    });
    mockUseRequireAuth.mockReturnValue({
      redirectTo: null,
    });
    mockUseAuthStore.mockReturnValue({
      id: 'user-1',
    });
  });

  it('uses the storefront shell and list padding helper for the notifications view', () => {
    render(<NotificationsScreen />);
    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];
    const flashListProps = mockFlashList.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
    expect(
      StyleSheet.flatten(flashListProps?.contentContainerStyle)
    ).toMatchObject({
      padding: 16,
      gap: 12,
      flex: 1,
      justifyContent: 'center',
    });
  });
});
