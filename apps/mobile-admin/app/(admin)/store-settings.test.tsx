import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StoreSettingsScreen from './store-settings';

interface MockMerchant {
  business_name: string;
  country: string;
  email: string;
  id: string;
  logo_url: string | null;
  phone: string;
  payout_currency: string;
  slug: string;
  support_email: string | null;
  support_phone: string | null;
}

interface MockUseMerchantResult {
  isLoading: boolean;
  merchant: MockMerchant | null;
}

const mocks = vi.hoisted(() => ({
  routerBack: vi.fn(),
  routeParams: {} as { from?: string },
  getManagementLabel: vi.fn(() => 'Manage from helper'),
  getPlanLabel: vi.fn(() => 'Baci Pro'),
  useCachedImageUri: vi.fn(() => ({ isLoading: false, uri: null })),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
  useMutation: vi.fn(),
  useMerchantResult: {
    isLoading: false,
    merchant: {
      business_name: 'Baci Store',
      country: 'NG',
      email: 'owner@baci.test',
      id: 'merchant-1',
      logo_url: null,
      phone: '08012345678',
      payout_currency: 'NGN',
      slug: 'baci-store',
      support_email: null,
      support_phone: null,
    },
  } as MockUseMerchantResult,
  subscriptionCardProps: {
    manageSubscriptionLabel: '',
    planLabel: '',
  },
  detailsCardProps: {
    countryCode: '',
    email: '',
  },
  statusModalProps: {
    message: '',
    title: '',
    type: '',
    visible: false,
  },
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mocks.invalidateStoreReadiness,
}));

function Text({ children }: { children?: ReactNode }) {
  return <span>{children}</span>;
}

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useLocalSearchParams: () => mocks.routeParams,
    useRouter: () => ({ back: mocks.routerBack }),
    Stack: {
      Screen: () => React.createElement('div', null),
    },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: { onSuccess?: () => Promise<void> | void }) => {
    mocks.useMutation(options);
    return {
      isPending: false,
      mutate: vi.fn(),
    };
  },
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      primary: '#2563eb',
      text: '#0f172a',
      textSecondary: '#334155',
    },
    isDark: false,
    shadows: { sm: {} },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => mocks.useMerchantResult,
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({ isPro: true }),
}));

vi.mock('@/hooks/useCachedImageUri', () => ({
  useCachedImageUri: mocks.useCachedImageUri,
}));

vi.mock('@/hooks/useSubscriptionManagement', () => ({
  useSubscriptionManagement: () => ({
    handleManageSubscription: vi.fn(),
  }),
}));

vi.mock('@/utils/SubscriptionManagement', () => ({
  SubscriptionManagement: {
    getManagementLabel: mocks.getManagementLabel,
    getPlanLabel: mocks.getPlanLabel,
  },
}));

vi.mock('@/components/ui/AppFormScreen', () => ({
  AppFormScreen: ({ children }: { children?: ReactNode }) => (
    <section aria-label="store-settings-form">{children}</section>
  ),
}));

vi.mock('@/components/store-settings/StoreSubscriptionCard', () => ({
  StoreSubscriptionCard: ({
    manageSubscriptionLabel,
    planLabel,
  }: {
    manageSubscriptionLabel: string;
    planLabel: string;
  }) => {
    mocks.subscriptionCardProps.manageSubscriptionLabel =
      manageSubscriptionLabel;
    mocks.subscriptionCardProps.planLabel = planLabel;
    return (
      <div>
        <Text>subscription-card</Text>
      </div>
    );
  },
}));

vi.mock('@/components/store-settings/StoreSettingsDetailsCard', () => ({
  StoreSettingsDetailsCard: ({
    countryCode,
    email,
  }: {
    countryCode: string;
    email: string;
  }) => {
    mocks.detailsCardProps = { countryCode, email };
    return (
      <div>
        <Text>details-card</Text>
      </div>
    );
  },
}));

vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: () => null,
}));

vi.mock('@/components/ui/LogoPicker', () => ({
  LogoPicker: () => <div />,
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => (
    <div>
      <Text>loading</Text>
    </div>
  ),
}));

vi.mock('@/components/ui/StatusModal', () => ({
  StatusModal: ({
    status,
  }: {
    status: {
      message: string;
      title: string;
      type: string;
      visible: boolean;
    };
  }) => {
    mocks.statusModalProps = status;
    return status.visible ? (
      <output aria-label="save-status">{`${status.title}: ${status.message}`}</output>
    ) : null;
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantIdentitySettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  ActivityIndicator: () => <output aria-label="loading" />,
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({
    accessibilityRole,
    children,
  }: {
    accessibilityRole?: string;
    children?: ReactNode;
  }) => <div role={accessibilityRole}>{children}</div>,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),

  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

describe('StoreSettingsScreen', () => {
  beforeEach(() => {
    mocks.getManagementLabel.mockReset();
    mocks.routerBack.mockReset();
    mocks.routeParams = {};
    mocks.getPlanLabel.mockReset();
    mocks.useCachedImageUri.mockReset();
    mocks.useCachedImageUri.mockReturnValue({ isLoading: false, uri: null });
    mocks.getManagementLabel.mockReturnValue('Manage from helper');
    mocks.getPlanLabel.mockReturnValue('Baci Pro');
    mocks.useMerchantResult = {
      isLoading: false,
      merchant: {
        business_name: 'Baci Store',
        country: 'NG',
        email: 'owner@baci.test',
        id: 'merchant-1',
        logo_url: null,
        phone: '08012345678',
        payout_currency: 'NGN',
        slug: 'baci-store',
        support_email: null,
        support_phone: null,
      },
    };
    mocks.subscriptionCardProps.manageSubscriptionLabel = '';
    mocks.subscriptionCardProps.planLabel = '';
    mocks.detailsCardProps = { countryCode: '', email: '' };
    mocks.statusModalProps = {
      message: '',
      title: '',
      type: '',
      visible: false,
    };
    mocks.invalidateQueries.mockReset();
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.invalidateStoreReadiness.mockReset();
    mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
    mocks.useMutation.mockClear();
  });

  it('uses SubscriptionManagement helper label for subscription actions', () => {
    render(<StoreSettingsScreen />);

    expect(screen.getByLabelText('store-settings-form')).toBeInTheDocument();
    expect(screen.getByText('subscription-card')).toBeInTheDocument();
    expect(mocks.subscriptionCardProps.manageSubscriptionLabel).toBe(
      'Manage from helper'
    );
    expect(mocks.subscriptionCardProps.planLabel).toBe('Baci Pro');
  });

  it('prefills support email from the merchant email and passes a valid phone country code', () => {
    if (mocks.useMerchantResult.merchant) {
      mocks.useMerchantResult.merchant.country = 'Nigeria';
      mocks.useMerchantResult.merchant.support_email = null;
    }

    render(<StoreSettingsScreen />);

    expect(mocks.detailsCardProps).toEqual({
      countryCode: 'NG',
      email: 'owner@baci.test',
    });
  });

  it('requests a target-sized store logo', () => {
    const logoUrl =
      'https://project.supabase.co/storage/v1/object/public/media/logo.png';
    if (mocks.useMerchantResult.merchant) {
      mocks.useMerchantResult.merchant.logo_url = logoUrl;
    }

    render(<StoreSettingsScreen />);

    expect(mocks.useCachedImageUri).toHaveBeenCalledWith(logoUrl, {
      height: 256,
      resize: 'contain',
      width: 256,
    });
  });

  it('keeps the no-logo fallback while requesting the same target size', () => {
    render(<StoreSettingsScreen />);

    expect(mocks.useCachedImageUri).toHaveBeenCalledWith(null, {
      height: 256,
      resize: 'contain',
      width: 256,
    });
  });

  it('falls back to default management label when helper output is empty', () => {
    mocks.getManagementLabel.mockReturnValue('');

    render(<StoreSettingsScreen />);

    expect(mocks.subscriptionCardProps.manageSubscriptionLabel).toBe(
      'Manage Subscription'
    );
  });

  it('falls back to Free Plan when helper plan label output is empty', () => {
    mocks.getPlanLabel.mockReturnValue('');

    render(<StoreSettingsScreen />);

    expect(mocks.subscriptionCardProps.planLabel).toBe('Free Plan');
  });

  it('renders loading state while merchant profile is resolving', () => {
    mocks.useMerchantResult = {
      isLoading: true,
      merchant: null,
    } as MockUseMerchantResult;

    render(<StoreSettingsScreen />);

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByText('subscription-card')).not.toBeInTheDocument();
  });

  it('shows a retry state when merchant loading settles without a merchant', () => {
    mocks.useMerchantResult = {
      isLoading: false,
      merchant: null,
    };

    render(<StoreSettingsScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load store settings. Please try again."
    );
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading store settings' })
    );

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
  });

  it('still refreshes merchant data when success settles without merchant context', async () => {
    mocks.useMerchantResult.merchant = null;

    render(<StoreSettingsScreen />);
    const mutationOptions = mocks.useMutation.mock.calls.at(-1)?.[0] as
      | { onSuccess?: () => Promise<void> | void }
      | undefined;

    await act(async () => {
      await expect(mutationOptions?.onSuccess?.()).resolves.toBeUndefined();
    });
    expect(mocks.invalidateQueries).toHaveBeenCalled();
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('shows saved settings when the post-save readiness refresh rejects', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('readiness unavailable')
    );
    render(<StoreSettingsScreen />);
    const mutationOptions = mocks.useMutation.mock.calls.at(-1)?.[0] as
      | { onSuccess?: () => Promise<void> | void }
      | undefined;

    await act(async () => {
      await expect(mutationOptions?.onSuccess?.()).resolves.toBeUndefined();
    });

    expect(
      screen.getByRole('status', { name: 'save-status' })
    ).toHaveTextContent('Success!: Store settings updated successfully.');
  });

  it('returns to the checklist without a success popup after a checklist save', async () => {
    mocks.routeParams = { from: 'setup' };
    render(<StoreSettingsScreen />);
    const mutationOptions = mocks.useMutation.mock.calls.at(-1)?.[0] as
      | { onSuccess?: () => Promise<void> | void }
      | undefined;

    await act(async () => {
      await expect(mutationOptions?.onSuccess?.()).resolves.toBeUndefined();
    });

    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status', { name: 'save-status' })).toBeNull();
  });
});
