import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import NotificationsScreen from '@/app/notifications';

interface MockFlashListProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

type MockNotificationsListStyleOptions = {
  includeBottomInset?: boolean;
};

interface MockStorefrontShellProps extends ViewProps {
  children?: React.ReactNode;
  edges?: readonly string[];
}

const mockFlashList = jest.fn(({ children, ...props }: MockFlashListProps) => (
  <View testID="notifications-flash-list" {...props}>
    {children}
  </View>
));
const mockStorefrontScreenShell = jest.fn(
  ({ children, ...props }: MockStorefrontShellProps) => (
    <View testID="storefront-screen-shell" {...props}>
      {children}
    </View>
  )
);
const mockGetListContentStyle =
  jest.fn<
    (options?: MockNotificationsListStyleOptions) => {
      gap: number;
      padding: number;
      paddingBottom: number;
    }
  >();
const mockUseStorefrontInsets = jest.fn();
const mockUseRequireAuth = jest.fn();
const mockUseAuthStore = jest.fn<() => { id: string } | null>();
const mockRedirect = jest.fn(({ href }: { href: string }) => (
  <View testID="notifications-redirect" accessibilityLabel={href} />
));
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => mockRedirect({ href }),
  Stack: {
    Screen: () => null,
  },
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data = [],
    ListEmptyComponent,
    children,
    ...props
  }: {
    data?: Array<{ id: string }>;
    children?: React.ReactNode;
    ListEmptyComponent?: React.ReactNode | (() => React.ReactNode);
  }) => {
    const emptyContent =
      data.length === 0
        ? typeof ListEmptyComponent === 'function'
          ? ListEmptyComponent()
          : ListEmptyComponent
        : children;

    return mockFlashList({
      children: emptyContent,
      ...props,
      data,
      ListEmptyComponent,
    });
  },
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
  useAuthStore: (
    selector: (state: { user: { id: string } | null }) => { id: string } | null
  ) =>
    selector({
      user: mockUseAuthStore(),
    }),
}));

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetListContentStyle.mockImplementation(
      (options?: MockNotificationsListStyleOptions) => ({
        padding: 16,
        gap: 12,
        paddingBottom: options?.includeBottomInset === false ? 16 : 50,
      })
    );
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: jest.fn(),
      getListContentStyle: mockGetListContentStyle,
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
    expect(mockGetListContentStyle).toHaveBeenCalledWith({
      includeBottomInset: false,
    });
    expect(
      StyleSheet.flatten(flashListProps?.contentContainerStyle)
    ).toMatchObject({
      padding: 16,
      flex: 1,
      justifyContent: 'center',
    });
  });

  it('redirects to login when the auth guard returns a redirect target', () => {
    mockUseRequireAuth.mockReturnValue({
      redirectTo: '/auth/login?returnTo=%2Fnotifications',
    });

    render(<NotificationsScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({
      href: '/auth/login?returnTo=%2Fnotifications',
    });
    expect(
      screen.getByLabelText('/auth/login?returnTo=%2Fnotifications')
    ).toBeOnTheScreen();
  });

  it('renders the signed-in empty-state copy', () => {
    render(<NotificationsScreen />);

    expect(screen.getByText('No notifications yet')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "We'll notify you about order updates and special offers"
      )
    ).toBeOnTheScreen();
  });

  it('renders the guest empty-state copy when no user is present', () => {
    mockUseAuthStore.mockReturnValue(null);

    render(<NotificationsScreen />);

    expect(
      screen.getByText('Sign in to receive order updates and special offers')
    ).toBeOnTheScreen();
  });
});
