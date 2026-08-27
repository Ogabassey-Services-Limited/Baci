import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  branchScope: { isAllLocations: true },
  createUploadFormData: vi.fn(),
  fetch: vi.fn(),
  getSession: vi.fn(),
  invalidateQueries: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  safeAreaEdges: null as null | readonly string[],
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    Alert: { alert: mocks.alert },
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
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync:
    mocks.requestMediaLibraryPermissionsAsync,
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
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
    ProgressCard: () => <Text>progress-card</Text>,
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
    WelcomeHeader: ({ onAvatarPress }: { onAvatarPress?: () => void }) => (
      <>
        <button
          aria-label="Change store avatar"
          onClick={onAvatarPress}
          type="button"
        />
        <Text>welcome-header</Text>
      </>
    ),
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
    isLive: true,
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
    isLoading: false,
    readiness: { isReady: true, overallProgress: 100 },
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
    auth: { getSession: mocks.getSession },
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
  createUploadFormData: mocks.createUploadFormData,
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.com',
}));

import HomeScreen from '../../../app/(admin)/(tabs)/index';

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.branchScope = { isAllLocations: true };
    mocks.safeAreaEdges = null;
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    mocks.launchImageLibraryAsync.mockResolvedValue({
      assets: [
        {
          fileName: 'store-avatar.jpg',
          mimeType: 'image/jpeg',
          uri: 'file:///store-avatar.jpg',
        },
      ],
      canceled: false,
    });
    const formData = new FormData();
    formData.append(
      'file',
      new Blob(['image-bytes'], { type: 'image/jpeg' }),
      'store-avatar.jpg'
    );
    mocks.createUploadFormData.mockResolvedValue(formData);
    mocks.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: true }),
      ok: true,
    });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('navigates to negotiations when Negotiations quick action is pressed', () => {
    render(<HomeScreen />);

    const button = screen.getByRole('button', { name: 'Negotiations' });
    fireEvent.click(button);

    expect(router.push).toHaveBeenCalledWith('/(admin)/negotiations');
  });

  it('sends a Blob-backed multipart body when changing the store avatar', async () => {
    render(<HomeScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Change store avatar' })
    );

    await waitFor(() => {
      expect(mocks.createUploadFormData).toHaveBeenCalledWith({
        name: 'store-avatar.jpg',
        type: 'image/jpeg',
        uri: 'file:///store-avatar.jpg',
      });
      expect(mocks.fetch).toHaveBeenCalledWith(
        'https://example.com/api/merchant/favicon',
        expect.objectContaining({
          body: expect.any(FormData),
          headers: { Authorization: 'Bearer test-token' },
          method: 'POST',
        })
      );
    });
  });

  it('surfaces avatar upload failures instead of failing silently', async () => {
    mocks.fetch.mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({ error: 'Upload rejected' }),
      ok: false,
    });

    render(<HomeScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Change store avatar' })
    );

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Upload rejected');
    });
  });
});
