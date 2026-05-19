import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_KEYBOARD_CONTAINER_LABEL } from '../auth/app-keyboard-container.mock';

const mocks = vi.hoisted(() => {
  const eq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq }));

  return {
    back: vi.fn(),
    invalidateQueries: vi.fn(),
    update,
    eq,
    useMerchant: vi.fn(),
  };
});

function createMutationMock() {
  return ({
    mutationFn,
    onError,
    onSuccess,
  }: {
    mutationFn: () => Promise<void>;
    onError?: (error: Error) => void;
    onSuccess?: () => void;
  }) => ({
    isPending: false,
    mutate: async () => {
      try {
        await mutationFn();
        onSuccess?.();
      } catch (error) {
        onError?.(error as Error);
      }
    },
  });
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: createMutationMock(),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('@/components/ui/AppFormScreen', async () => {
  const { createAppFormScreenMock } = await import(
    '../auth/app-form-screen.mock'
  );
  return createAppFormScreenMock();
});

vi.mock('@/components/store-settings/StoreSettingsDetailsCard', () => ({
  StoreSettingsDetailsCard: ({
    businessName,
    countryLabel,
    currency,
    onOpenCountryPicker,
  }: {
    businessName: string;
    countryLabel: string;
    currency: string;
    onOpenCountryPicker: () => void;
  }) => (
    <div>
      <span>Business: {businessName}</span>
      <span>Country: {countryLabel}</span>
      <span>Currency: {currency}</span>
      <button
        aria-label="Open country picker"
        onClick={onOpenCountryPicker}
        type="button"
      >
        Open country picker
      </button>
    </div>
  ),
}));

vi.mock('@/components/store-settings/StoreSubscriptionCard', () => ({
  StoreSubscriptionCard: ({
    manageSubscriptionLabel,
    onManageSubscription,
    planLabel,
  }: {
    manageSubscriptionLabel: string;
    onManageSubscription: () => void;
    planLabel: string;
  }) => (
    <div>
      <span>Plan: {planLabel}</span>
      <span>Manage label: {manageSubscriptionLabel}</span>
      <button
        aria-label={manageSubscriptionLabel}
        onClick={onManageSubscription}
        type="button"
      >
        Manage subscription
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: ({
    onClose,
    onSelect,
    visible,
  }: {
    onClose: () => void;
    onSelect: (country: {
      code: string;
      currency: string;
      name: string;
    }) => void;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        <button
          aria-label="Choose Ghana"
          onClick={() =>
            onSelect({ code: 'GH', currency: 'GHS', name: 'Ghana' })
          }
          type="button"
        >
          Choose Ghana
        </button>
        <button
          aria-label="Close country picker"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/ui/LogoPicker', () => ({
  LogoPicker: () => <div>Logo picker</div>,
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <div>Loading skeleton</div>,
}));

vi.mock('@/components/ui/StatusModal', () => ({
  StatusModal: ({
    onClose,
    status,
  }: {
    onClose: () => void;
    status: { message: string; title: string; visible: boolean };
  }) =>
    status.visible ? (
      <div>
        <span>{status.title}</span>
        <span>{status.message}</span>
        <button aria-label="Close status modal" onClick={onClose} type="button">
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('@/hooks/useCachedImageUri', () => ({
  useCachedImageUri: () => ({ uri: 'https://example.com/logo.png' }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({ isPro: true }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      cardHover: '#1f2937',
      primary: '#3b82f6',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
    },
    isDark: true,
    shadows: {
      sm: {},
    },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: mocks.update,
    }),
  },
}));

vi.mock('@/utils/SubscriptionManagement', () => ({
  SubscriptionManagement: {
    getManagementLabel: () => 'Manage in App Store',
    getPlanLabel: (isPro: boolean) => (isPro ? 'Pro' : 'Free'),
    openNativeManagement: vi.fn(),
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');

  return {
    Stack: {
      Screen: ({
        options,
      }: {
        options?: {
          headerLeft?: () => React.ReactNode;
          headerRight?: () => React.ReactNode;
          title?: string;
        };
      }) =>
        React.createElement(
          'div',
          null,
          options?.title
            ? React.createElement('span', null, options.title)
            : null,
          options?.headerLeft ? options.headerLeft() : null,
          options?.headerRight ? options.headerRight() : null
        ),
    },
    useRouter: () => ({
      back: mocks.back,
      push: vi.fn(),
    }),
  };
});

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Platform: { OS: 'ios' },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import StoreSettingsScreen from '@/app/(admin)/store-settings';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';

describe('StoreSettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_address: '12 Allen Avenue',
        business_name: 'Baci Foods',
        country: 'NG',
        email: 'support@usebaci.com',
        logo_url: 'https://example.com/logo.png',
        payout_currency: 'NGN',
        phone: '+2348012345678',
        slug: 'baci-foods',
        support_email: null,
        support_phone: null,
      },
      isLoading: false,
    });
  });

  it('renders inside the shared form shell and updates country state from the picker', () => {
    render(<StoreSettingsScreen />);

    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeInTheDocument();
    expect(screen.getByText('Business: Baci Foods')).toBeInTheDocument();
    expect(screen.getByText('Country: Nigeria')).toBeInTheDocument();
    expect(screen.getByText('Currency: NGN')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open country picker' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose Ghana' }));

    expect(screen.getByText('Country: Ghana')).toBeInTheDocument();
    expect(screen.getByText('Currency: GHS')).toBeInTheDocument();
  });

  it('saves merchant settings through the shared shell flow', async () => {
    render(<StoreSettingsScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        business_address: '12 Allen Avenue',
        business_name: 'Baci Foods',
        country: 'NG',
        payout_currency: 'NGN',
        phone: '+2348012345678',
        slug: 'baci-foods',
        support_email: 'support@usebaci.com',
        support_phone: '+2348012345678',
      });
    });

    expect(await screen.findByText('Success!')).toBeInTheDocument();
    expect(mocks.eq).toHaveBeenCalledWith('id', 'merchant-1');
    expect(
      await screen.findByText('Store settings updated successfully.')
    ).toBeInTheDocument();
  });

  it('does not show the status modal when native subscription management returns false', async () => {
    vi.mocked(
      SubscriptionManagement.openNativeManagement
    ).mockResolvedValueOnce(false);

    render(<StoreSettingsScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage in App Store' })
    );

    await waitFor(() => {
      expect(SubscriptionManagement.openNativeManagement).toHaveBeenCalledTimes(
        1
      );
    });

    expect(
      screen.queryByText(
        'Could not open subscription management. Please try again.'
      )
    ).not.toBeInTheDocument();
  });

  it('shows an error modal when native subscription management rejects', async () => {
    vi.mocked(
      SubscriptionManagement.openNativeManagement
    ).mockRejectedValueOnce(new Error('fail'));

    render(<StoreSettingsScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage in App Store' })
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to Open')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Could not open subscription management. Please try again.'
      )
    ).toBeInTheDocument();
  });
});
