import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import AccountScreen from './account';

const mockStorefrontScreenShell = jest.fn(({ children, ...props }) => (
  <View testID="storefront-screen-shell" {...props}>
    {children}
  </View>
));
const mockUseStorefrontInsets = jest.fn();
const mockUseMerchant = jest.fn();
const mockUseAuthStatus = jest.fn();
const mockGetAccountMenuSections = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
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

jest.mock('@/hooks', () => ({
  useMerchant: () => mockUseMerchant(),
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useAuthStatus: () => mockUseAuthStatus(),
}));

jest.mock('@/components/profile/account-menu', () => ({
  getAccountMenuSections: (...args: unknown[]) =>
    mockGetAccountMenuSections(...args),
}));

jest.mock('@/components/profile/MenuSection', () => ({
  MenuSection: ({ title }: { title: string }) => {
    const React = jest.requireActual('react') as typeof import('react');
    const { Text } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');

    return React.createElement(Text, null, title);
  },
}));

jest.mock('@/components/profile/ProfileHeader', () => ({
  ProfileHeader: () => {
    const React = jest.requireActual('react') as typeof import('react');
    const { View } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');

    return React.createElement(View, { testID: 'profile-header' });
  },
}));

jest.mock('@/components/profile/SocialLinks', () => ({
  SocialLinks: () => {
    const React = jest.requireActual('react') as typeof import('react');
    const { View } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');

    return React.createElement(View, { testID: 'social-links' });
  },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      customer: null;
      session: {
        user: {
          id: string;
          email: string;
          user_metadata: Record<string, unknown>;
        };
      } | null;
      signOut: () => Promise<void>;
    }) => unknown
  ) =>
    selector({
      customer: null,
      session: {
        user: {
          id: 'user-1',
          email: 'merchant@example.com',
          user_metadata: {},
        },
      },
      signOut: jest.fn(async () => undefined),
    }),
}));

describe('AccountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: () => ({ paddingTop: 20, paddingBottom: 60 }),
      getListContentStyle: jest.fn(),
    });
    mockUseMerchant.mockReturnValue({
      data: { social_media: null, phone: null },
    });
    mockUseAuthStatus.mockReturnValue({
      isInitialized: true,
      user: { id: 'user-1' },
    });
    mockGetAccountMenuSections.mockReturnValue([
      {
        title: 'Account',
        visible: true,
        items: [],
      },
    ]);
  });

  it('uses the storefront shell and scroll padding helper for the account layout', () => {
    render(<AccountScreen />);
    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];
    const scrollView = screen.getByTestId('account-scrollview');

    expect(shellProps?.edges).toEqual(['top']);
    expect(scrollView.props.contentContainerStyle).toEqual({
      paddingTop: 20,
      paddingBottom: 60,
    });
  });

  it('renders a loading state before auth initialization completes', () => {
    mockUseAuthStatus.mockReturnValue({
      isInitialized: false,
      user: null,
    });

    const view = render(<AccountScreen />);

    expect(view.toJSON()).not.toBeNull();
    expect(mockStorefrontScreenShell).not.toHaveBeenCalled();
    expect(screen.queryByTestId('account-scrollview')).toBeNull();
  });

  it('returns null when there is no authenticated user', () => {
    mockUseAuthStatus.mockReturnValue({
      isInitialized: true,
      user: null,
    });

    const view = render(<AccountScreen />);

    expect(view.toJSON()).toBeNull();
    expect(mockStorefrontScreenShell).not.toHaveBeenCalled();
  });

  it('filters out hidden menu sections before rendering', () => {
    mockGetAccountMenuSections.mockReturnValue([
      {
        title: 'Visible Section',
        visible: true,
        items: [],
      },
      {
        title: 'Hidden Section',
        visible: false,
        items: [],
      },
    ]);

    render(<AccountScreen />);

    expect(screen.getByText('Visible Section')).toBeTruthy();
    expect(screen.queryByText('Hidden Section')).toBeNull();
  });
});
