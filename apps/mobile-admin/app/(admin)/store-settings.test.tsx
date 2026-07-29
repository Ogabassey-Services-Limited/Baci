import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StoreSettingsScreen from './store-settings';

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));

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
  getManagementLabel: vi.fn(() => 'Manage from helper'),
  getPlanLabel: vi.fn(() => 'Baci Pro'),
  useCachedImageUri: vi.fn(() => ({ isLoading: false, uri: null })),
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
}));

function Text({ children }: { children?: ReactNode }) {
  return <span>{children}</span>;
}

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({ back: vi.fn() }),
    Stack: {
      Screen: () => React.createElement('div', null),
    },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
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
  StoreSettingsDetailsCard: () => (
    <div>
      <Text>details-card</Text>
    </div>
  ),
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
  StatusModal: () => null,
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

vi.mock('react-native', () => ({
  StatusBar: () => null,
  ActivityIndicator: () => <output aria-label="loading" />,
  Pressable: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
});
