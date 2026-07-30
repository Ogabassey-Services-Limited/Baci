import '@testing-library/jest-dom/vitest';
import type { MobileStoreReadiness } from '@baci/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  publishStore: vi.fn(),
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

vi.mock('@/hooks/useStorePublish', () => ({
  useStorePublish: () => ({
    isPublishing: false,
    publishStore: mocks.publishStore,
  }),
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
    render(<SetupChecklistScreen />);

    expect(
      screen.getByRole('button', { name: /publish store now/i })
    ).toBeInTheDocument();
  });

  it('hides the publish button when setup is not ready or already published', () => {
    const readiness = requireReadiness();
    readiness.isReady = false;

    const { rerender } = render(<SetupChecklistScreen />);

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

    render(<SetupChecklistScreen />);

    fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));
    expect(mocks.routerPush).toHaveBeenCalledWith(
      '/payout-settings?from=setup'
    );
  });

  it('publishes through the shared publish hook', () => {
    mocks.publishStore.mockResolvedValueOnce(undefined);

    render(<SetupChecklistScreen />);

    fireEvent.click(screen.getByRole('button', { name: /publish store now/i }));

    expect(mocks.publishStore).toHaveBeenCalledTimes(1);
  });

  it('surfaces publish errors via Alert.alert without crashing', async () => {
    mocks.publishStore.mockRejectedValueOnce(
      new Error('Cannot publish store\n- Bank account details')
    );

    render(<SetupChecklistScreen />);

    fireEvent.click(screen.getByRole('button', { name: /publish store now/i }));

    // Wait a microtask so the rejected promise is handled by handlePublish.
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.publishStore).toHaveBeenCalledTimes(1);
    expect(mocks.alert).toHaveBeenCalled();
    const [, message] = mocks.alert.mock.calls[0] ?? [];
    expect(message).toContain('Cannot publish store');
    expect(message).toContain('Bank account details');
  });

  it('shows an accessible retry state when the first readiness request fails', () => {
    mocks.readiness = null;
    mocks.error = new Error('offline');

    render(<SetupChecklistScreen />);

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

    render(<SetupChecklistScreen />);

    expect(screen.getByText('Ready to Launch 🚀')).toBeInTheDocument();
    expect(
      screen.queryByText('Unable to load store setup right now.')
    ).not.toBeInTheDocument();
  });
});
