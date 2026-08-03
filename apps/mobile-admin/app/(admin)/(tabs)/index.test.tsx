import { fireEvent, render, screen } from '@testing-library/react';
import { router } from 'expo-router';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoreReadinessMock = {
  isReady: boolean;
  isPublished: boolean;
  overallProgress: number;
};

type StoreSetupStatusCardMockProps = {
  isLive: boolean;
  isLoading: boolean;
  readiness: StoreReadinessMock | null | undefined;
};

const mocks = vi.hoisted(() => ({
  branchScope: { isAllLocations: true },
  isLive: true,
  isReadinessLoading: false,
  readiness: {
    isReady: true,
    isPublished: true,
    overallProgress: 100,
  } as StoreReadinessMock | null,
  safeAreaEdges: null as null | readonly string[],
  storeSetupStatusCardProps: null as StoreSetupStatusCardMockProps | null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    Alert: { alert: vi.fn() },
    Pressable: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('button', null, children),
    RefreshControl: () => null,
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Share: { share: vi.fn() },
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
    edges,
  }: {
    children?: React.ReactNode;
    edges?: readonly string[];
  }) => {
    mocks.safeAreaEdges = edges ?? null;
    return <div>{children}</div>;
  },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: unknown) => selector,
}));

vi.mock('@/components/dashboard', async () => {
  const { Text } = await import('react-native');

  return {
    BranchSwitcher: () => <Text>branch-switcher</Text>,
    InsightCard: () => <Text>insight-card</Text>,
    QuickActionButton: ({
      label,
      onPress,
    }: {
      label: string;
      onPress?: () => void;
    }) => (
      <button type="button" onClick={onPress}>
        {label}
      </button>
    ),
    RevenueChart: () => <Text>revenue-chart</Text>,
    StatCard: ({ label }: { label: string }) => <Text>{label}</Text>,
    StoreSetupStatusCard: (props: StoreSetupStatusCardMockProps) => {
      mocks.storeSetupStatusCardProps = props;
      return <Text>store-setup-status-card</Text>;
    },
    WelcomeHeader: () => <Text>welcome-header</Text>,
  };
});

vi.mock('@/hooks/useDashboardStats', () => ({
  useDashboardStats: () => ({
    refetch: vi.fn(),
    revenueData: [],
    stats: {
      newCustomers: 0,
      orders: 10,
      pendingOrders: 0,
      previousPeriodRevenue: 0,
      revenue: 12500000,
      totalItems: 11,
      visits: 5700,
    },
  }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => mocks.branchScope,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLive: mocks.isLive,
    merchant: {
      business_name: 'Ogabassey Services Limited',
      favicon_png_192_url: null,
      id: 'merchant-1',
      logo_url: null,
      payout_currency: 'NGN',
    },
    primaryDomain: null,
    storeUrl: 'ogabassey.baci.shop',
  }),
}));

vi.mock('@/hooks/useOrders', () => ({
  useOrders: () => ({
    data: {
      pages: [
        {
          orders: [],
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useSettingsStore', () => ({
  useSettingsStore: (
    selector: (state: {
      setInsightDismissed: () => void;
      shouldShowInsight: () => boolean;
    }) => unknown
  ) =>
    selector({
      setInsightDismissed: vi.fn(),
      shouldShowInsight: () => false,
    }),
}));

vi.mock('@/hooks/useStoreReadiness', () => ({
  useStoreReadiness: () => ({
    isLoading: mocks.isReadinessLoading,
    readiness: mocks.readiness,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#f8fafc',
      border: '#e2e8f0',
      card: '#ffffff',
      cardHover: '#f1f5f9',
      gold: '#f59e0b',
      goldLight: '#fef3c7',
      info: '#3b82f6',
      notification: '#ef4444',
      orange: '#f97316',
      orangeLight: '#ffedd5',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      success: '#22c55e',
      successLight: '#dcfce7',
      text: '#0f172a',
      textSecondary: '#64748b',
      textMuted: '#94a3b8',
    },
    shadows: { md: {}, sm: {} },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: vi.fn() }) }),
    storage: {
      from: () => ({
        getPublicUrl: () => ({
          data: { publicUrl: 'https://example.com/icon.png' },
        }),
        upload: vi.fn(),
      }),
    },
  },
}));

vi.mock('@/types/upload', () => ({
  createUploadFile: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.com',
}));

import HomeScreen from './index';

describe('HomeScreen', () => {
  beforeEach(() => {
    mocks.branchScope = { isAllLocations: true };
    mocks.isLive = true;
    mocks.isReadinessLoading = false;
    mocks.readiness = {
      isReady: true,
      isPublished: true,
      overallProgress: 100,
    };
    mocks.safeAreaEdges = null;
    mocks.storeSetupStatusCardProps = null;
    vi.clearAllMocks();
  });

  it('reserves the top safe area on the dashboard tab', () => {
    render(<HomeScreen />);

    screen.getByText('welcome-header');
    screen.getByText('Visits');
    screen.getByText('New');
    expect(mocks.safeAreaEdges).toEqual(['top']);
  });

  it('keeps concise metric labels when scoped to a single branch', () => {
    mocks.branchScope = { isAllLocations: false };

    render(<HomeScreen />);

    screen.getByText('Visits');
    screen.getByText('New');
    expect(screen.queryByText('Visits (all stores)')).toBeNull();
    expect(screen.queryByText('New (all stores)')).toBeNull();
  });

  it('forwards completed setup readiness to the setup status card', () => {
    render(<HomeScreen />);

    expect(mocks.storeSetupStatusCardProps).toEqual({
      isLive: true,
      isLoading: false,
      readiness: {
        isReady: true,
        isPublished: true,
        overallProgress: 100,
      },
    });
  });

  it('forwards incomplete setup readiness to the setup status card', () => {
    mocks.isLive = false;
    mocks.readiness = {
      isReady: false,
      isPublished: false,
      overallProgress: 71,
    };

    render(<HomeScreen />);

    expect(mocks.storeSetupStatusCardProps).toEqual({
      isLive: false,
      isLoading: false,
      readiness: {
        isReady: false,
        isPublished: false,
        overallProgress: 71,
      },
    });
  });

  it('forwards loading state while setup readiness has not loaded', () => {
    mocks.isReadinessLoading = true;
    mocks.readiness = null;

    render(<HomeScreen />);

    expect(mocks.storeSetupStatusCardProps).toEqual({
      isLive: true,
      isLoading: true,
      readiness: null,
    });
  });

  it('navigates to negotiations when Negotiations quick action is pressed', () => {
    render(<HomeScreen />);

    const button = screen.getByRole('button', { name: 'Negotiations' });
    fireEvent.click(button);

    expect(router.push).toHaveBeenCalledWith('/(admin)/negotiations');
  });
});
