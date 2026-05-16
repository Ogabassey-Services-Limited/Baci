import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import StoreSettingsScreen from './store-settings';

const mocks = vi.hoisted(() => ({
  subscriptionCardProps: {
    manageSubscriptionLabel: '',
    planLabel: '',
  },
}));

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
  useMerchant: () => ({
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
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({ isPro: true }),
}));

vi.mock('@/hooks/useCachedImageUri', () => ({
  useCachedImageUri: () => ({ uri: null }),
}));

vi.mock('@/hooks/useSubscriptionManagement', () => ({
  useSubscriptionManagement: () => ({
    handleManageSubscription: vi.fn(),
  }),
}));

vi.mock('@/utils/SubscriptionManagement', () => ({
  SubscriptionManagement: {
    getManagementLabel: () => 'Manage from helper',
    getPlanLabel: () => 'Baci Pro',
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
    return <div>subscription-card</div>;
  },
}));

vi.mock('@/components/store-settings/StoreSettingsDetailsCard', () => ({
  StoreSettingsDetailsCard: () => <div>details-card</div>,
}));

vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: () => null,
}));

vi.mock('@/components/ui/LogoPicker', () => ({
  LogoPicker: () => <div>logo-picker</div>,
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <div>loading</div>,
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

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Pressable: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

describe('StoreSettingsScreen', () => {
  it('uses SubscriptionManagement helper label for subscription actions', () => {
    render(<StoreSettingsScreen />);

    expect(screen.getByLabelText('store-settings-form')).toBeInTheDocument();
    expect(screen.getByText('subscription-card')).toBeInTheDocument();
    expect(mocks.subscriptionCardProps.manageSubscriptionLabel).toBe(
      'Manage from helper'
    );
    expect(mocks.subscriptionCardProps.planLabel).toBe('Baci Pro');
  });
});
