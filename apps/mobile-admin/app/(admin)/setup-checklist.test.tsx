import '@testing-library/jest-dom/vitest';
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
    items: [],
    overallProgress: 90,
    totalRecommended: 2,
    totalRequired: 5,
  },
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
    isLoading: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock('@/hooks/useStorePublish', () => ({
  useStorePublish: () => ({
    isPublishing: false,
    publishStore: mocks.publishStore,
  }),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: {
    alert: mocks.alert,
  },
  Pressable: ({
    children,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={disabled} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import SetupChecklistScreen from './setup-checklist';

describe('SetupChecklistScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.readiness.isReady = false;

    const { rerender } = render(<SetupChecklistScreen />);

    expect(
      screen.queryByRole('button', { name: /publish store now/i })
    ).not.toBeInTheDocument();

    mocks.readiness.isReady = true;
    mocks.readiness.isPublished = true;

    rerender(<SetupChecklistScreen />);

    expect(
      screen.queryByRole('button', { name: /publish store now/i })
    ).not.toBeInTheDocument();
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
});
