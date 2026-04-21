import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, View } from 'react-native';
import { ADDRESS_LIST_BOTTOM_PADDING } from './constants';
import AddressesScreen from './index';
import type { Address } from './types';

type MockStorefrontScreenShellProps = {
  children?: ReactNode;
  edges?: readonly string[];
};

const mockStorefrontScreenShell =
  jest.fn<({ children, edges }: MockStorefrontScreenShellProps) => void>();
const mockGetListContentStyle = jest.fn();
const mockNormalizeSavedAddresses = jest.fn(
  (addresses: Address[]) => addresses
);
const mockRedirect = jest.fn(({ href }: { href: string }) => (
  <View testID="addresses-redirect" accessibilityLabel={href} />
));
const mockSingle =
  jest.fn<
    () => Promise<{ data: { saved_addresses: Address[] }; error: Error | null }>
  >();
const mockQuery = {
  eq: jest.fn(),
  single: mockSingle,
};
const mockUpdateQuery = {
  eq: jest.fn(),
};
const mockFrom = jest.fn(() => ({
  select: jest.fn(() => mockQuery),
  update: jest.fn(() => mockUpdateQuery),
}));
const mockUseRequireAuth = jest.fn();
const mockUseAuthCustomer = jest.fn<() => { id: string } | null>();
const mockUseMerchantId = jest.fn<() => string | null>();
const mockUseStorefrontInsets = jest.fn();
const mockRouterPush = jest.fn();

function queueUpdateResult(result: { error: Error | null }) {
  mockUpdateQuery.eq.mockReset();
  mockUpdateQuery.eq
    .mockImplementationOnce(() => mockUpdateQuery)
    .mockImplementationOnce(() => Promise.resolve(result));
}

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => mockRedirect({ href }),
  Stack: {
    Screen: () => null,
  },
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: MockStorefrontScreenShellProps) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    mockStorefrontScreenShell({ children, ...props });
    return <View testID="storefront-screen-shell">{children}</View>;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/saved-addresses', () => ({
  normalizeSavedAddresses: (addresses: Address[]) =>
    mockNormalizeSavedAddresses(addresses),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => mockFrom(),
  },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      customer: { id: string } | null;
      merchantId: string | null;
    }) => unknown
  ) =>
    selector({
      customer: mockUseAuthCustomer(),
      merchantId: mockUseMerchantId(),
    }),
}));

describe('AddressesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.eq.mockReturnValue(mockQuery);
    queueUpdateResult({ error: null });
    mockGetListContentStyle.mockReturnValue({
      gap: 12,
      padding: 16,
      paddingBottom: ADDRESS_LIST_BOTTOM_PADDING,
    });
    mockUseStorefrontInsets.mockReturnValue({
      getListContentStyle: mockGetListContentStyle,
      getScrollContentStyle: jest.fn(),
    });
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
    });
    mockUseAuthCustomer.mockReturnValue({
      id: 'customer-1',
    });
    mockUseMerchantId.mockReturnValue('merchant-1');
    mockNormalizeSavedAddresses.mockImplementation((addresses) => addresses);
    mockSingle.mockResolvedValue({
      data: {
        saved_addresses: [],
      },
      error: null,
    });
  });

  it('uses the storefront shell and list inset helper for the addresses layout', async () => {
    render(<AddressesScreen />);

    await waitFor(() => {
      expect(mockStorefrontScreenShell).toHaveBeenCalled();
    });

    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
    expect(mockGetListContentStyle).toHaveBeenCalledWith({
      includeBottomInset: false,
      paddingBottom: ADDRESS_LIST_BOTTOM_PADDING,
    });
  });

  it('shows the floating add button when saved addresses exist', async () => {
    mockSingle.mockResolvedValue({
      data: {
        saved_addresses: [
          {
            id: 'address-1',
            label: 'Home',
            full_name: 'Ada Lovelace',
            phone: '08030000000',
            address: '12 Marina Road',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
            postal_code: '100001',
            is_default: true,
          },
        ],
      },
      error: null,
    });

    render(<AddressesScreen />);

    const addButton = await screen.findByRole('button', {
      name: 'Add Address',
    });

    fireEvent.press(addButton);

    expect(mockRouterPush).toHaveBeenCalledWith('/addresses/new');
  });

  it('redirects to sign in when the auth guard returns a redirect target', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: '/auth/login?returnTo=%2Faddresses',
    });
    mockUseAuthCustomer.mockReturnValue(null);
    mockUseMerchantId.mockReturnValue(null);

    render(<AddressesScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({
      href: '/auth/login?returnTo=%2Faddresses',
    });
    expect(
      screen.getByTestId('addresses-redirect').props.accessibilityLabel
    ).toBe('/auth/login?returnTo=%2Faddresses');
  });

  it('renders the fetch error state when loading saved addresses fails', async () => {
    mockSingle.mockResolvedValue({
      data: { saved_addresses: [] },
      error: new Error('fetch failed'),
    });

    render(<AddressesScreen />);

    expect(await screen.findByText('Failed to load addresses')).toBeTruthy();
    expect(screen.getByText('Tap to retry')).toBeTruthy();
  });

  it('shows an alert when deleting an address fails', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    mockSingle.mockResolvedValue({
      data: {
        saved_addresses: [
          {
            id: 'address-1',
            label: 'Home',
            full_name: 'Ada Lovelace',
            phone: '08030000000',
            address: '12 Marina Road',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
            postal_code: '100001',
            is_default: true,
          },
        ],
      },
      error: null,
    });
    queueUpdateResult({ error: new Error('delete failed') });

    render(<AddressesScreen />);

    fireEvent.press(
      await screen.findByRole('button', { name: 'Address options for Home' })
    );

    const deleteMenuAction = alertSpy.mock.calls[0]?.[2]?.find(
      (button) => button?.text === 'Delete'
    );
    await deleteMenuAction?.onPress?.();

    const confirmDeleteAction = alertSpy.mock.calls[1]?.[2]?.find(
      (button) => button?.text === 'Delete'
    );

    await confirmDeleteAction?.onPress?.();

    expect(alertSpy).toHaveBeenLastCalledWith(
      'Error',
      'Failed to delete address'
    );
  });
});
