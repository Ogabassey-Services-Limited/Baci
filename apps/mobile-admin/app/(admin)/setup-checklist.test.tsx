import '@testing-library/jest-dom/vitest';
import type { MobileStoreReadiness } from '@baci/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  apiClient: vi.fn(),
  readiness: {
    completedRecommended: 1,
    completedRequired: 5,
    isPublished: false,
    isReady: true,
    merchantId: 'merchant-1',
    items: [],
    overallProgress: 90,
    storeBuild: {
      aiStatus: 'not_started',
      canApplyAiDraft: false,
      latestJobId: null,
      message: 'Starter storefront is ready.',
      starterStoreReady: true,
    },
    surface: 'mobile' as const,
    totalRecommended: 2,
    totalRequired: 5,
  } as MobileStoreReadiness | null,
  error: null as Error | null,
  isFetching: false,
  isLoading: false,
  refetch: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#1f2937',
      card: '#111827',
      cardHover: '#1f2937',
      primary: '#3b82f6',
      primaryLight: '#dbeafe',
      success: '#22c55e',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#94a3b8',
    },
    isDark: true,
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: {
      id: 'merchant-1',
    },
  }),
}));

vi.mock('@/hooks/useStoreReadiness', () => ({
  useStoreReadiness: () => ({
    readiness: mocks.readiness,
    error: mocks.error,
    isFetching: mocks.isFetching,
    isLoading: mocks.isLoading,
    refetch: mocks.refetch,
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mocks.apiClient(...args),
  NetworkError: class NetworkError extends Error {},
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', () => {
  const MockText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return {
    StatusBar: () => null,
    ActivityIndicator: () => <MockText>loading</MockText>,
    Alert: {
      alert: mocks.alert,
    },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
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
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: MockText,
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import SetupChecklistScreen from './setup-checklist';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function renderChecklist() {
  return render(<SetupChecklistScreen />, { wrapper: createWrapper() });
}

function requireReadiness() {
  if (!mocks.readiness) throw new Error('Expected readiness fixture');
  return mocks.readiness;
}

describe('SetupChecklistScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.error = null;
    mocks.isFetching = false;
    mocks.isLoading = false;
    mocks.readiness = {
      completedRecommended: 1,
      completedRequired: 5,
      isPublished: false,
      isReady: true,
      merchantId: 'merchant-1',
      items: [],
      overallProgress: 90,
      storeBuild: {
        aiStatus: 'not_started',
        canApplyAiDraft: false,
        latestJobId: null,
        message: 'Starter storefront is ready.',
        starterStoreReady: true,
      },
      surface: 'mobile',
      totalRecommended: 2,
      totalRequired: 5,
    };
    mocks.readiness.isPublished = false;
    mocks.readiness.isReady = true;
  });

  it('shows the publish button when all required steps are complete', () => {
    renderChecklist();

    expect(
      screen.getByRole('button', { name: /publish store now/i })
    ).toBeInTheDocument();
  });

  it('hides the publish button when setup is not ready or already published', () => {
    const readiness = requireReadiness();
    readiness.isReady = false;

    const { rerender } = renderChecklist();

    expect(
      screen.queryByRole('button', { name: /publish store now/i })
    ).not.toBeInTheDocument();

    readiness.isReady = true;
    readiness.isPublished = true;

    rerender(<SetupChecklistScreen />);

    expect(
      screen.queryByRole('button', { name: /publish store now/i })
    ).not.toBeInTheDocument();
  });

  it('navigates checklist items through the local mobile route adapter', () => {
    const bankAccountItem: MobileStoreReadiness['items'][number] = {
      category: 'payments',
      completed: false,
      description: 'Required to receive payments via Paystack',
      id: 'bank_account',
      label: 'Add bank account',
      priority: 'required',
    };
    requireReadiness().items = [bankAccountItem];

    renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));
    expect(mocks.routerPush).toHaveBeenCalledWith(
      '/payout-settings?from=setup'
    );
  });

  it('shows an accessible retry state when the first readiness request fails', () => {
    mocks.readiness = null;
    mocks.error = new Error('offline');

    renderChecklist();

    expect(
      screen.getByText('Unable to load store setup right now.')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading store setup' })
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('retains confirmed readiness when a background refresh fails', () => {
    mocks.error = new Error('offline');

    renderChecklist();

    expect(screen.getByText('Ready to Launch 🚀')).toBeInTheDocument();
    expect(
      screen.queryByText('Unable to load store setup right now.')
    ).not.toBeInTheDocument();
  });
});
