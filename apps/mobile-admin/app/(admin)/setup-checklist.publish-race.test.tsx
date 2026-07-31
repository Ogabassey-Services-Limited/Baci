import '@testing-library/jest-dom/vitest';
import type { MobileStoreReadiness } from '@baci/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  apiClient: vi.fn(),
  merchant: { id: 'merchant-a' } as { id: string } | null,
  readiness: null as MobileStoreReadiness | null,
  refetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#1f2937',
      card: '#111827',
      gold: '#f59e0b',
      info: '#3b82f6',
      infoLight: '#dbeafe',
      primary: '#3b82f6',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
      textSecondary: '#94a3b8',
    },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

vi.mock('@/hooks/useStoreReadiness', () => ({
  useStoreReadiness: () => ({
    error: null,
    isFetching: false,
    isLoading: false,
    readiness: mocks.readiness,
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
  default: () => null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: mocks.alert },
  Pressable: ({ children, disabled, onPress }: ButtonProps) => (
    <button disabled={disabled} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: ChildrenProps) => <div>{children}</div>,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: ChildrenProps) => <span>{children}</span>,
  View: ({ children }: ChildrenProps) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: ChildrenProps) => <div>{children}</div>,
}));

import SetupChecklistScreen from './setup-checklist';

vi.spyOn(console, 'error').mockImplementation(() => undefined);

type ButtonProps = ChildrenProps & {
  disabled?: boolean;
  onPress?: () => void;
};
type ChildrenProps = { children?: ReactNode };

function readinessFor(merchantId: string): MobileStoreReadiness {
  return {
    completedRecommended: 0,
    completedRequired: 5,
    isPublished: false,
    isReady: true,
    merchantId,
    items: [],
    overallProgress: 100,
    storeBuild: {
      aiStatus: 'not_started',
      canApplyAiDraft: false,
      latestJobId: null,
      message: 'Starter storefront is ready.',
      starterStoreReady: true,
    },
    surface: 'mobile',
    totalRecommended: 0,
    totalRequired: 5,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: ChildrenProps) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('SetupChecklistScreen publish merchant switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.merchant = { id: 'merchant-a' };
    mocks.readiness = readinessFor('merchant-a');
    mocks.refetch.mockResolvedValue(undefined);
  });

  it('shows success after a publish remains current', async () => {
    mocks.apiClient.mockResolvedValueOnce({ success: true });
    render(<SetupChecklistScreen />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /publish store now/i }));

    await waitFor(() =>
      expect(mocks.alert).toHaveBeenCalledWith(
        'Success',
        'Your store is now LIVE!'
      )
    );
  });

  it('surfaces a current publish failure', async () => {
    mocks.apiClient.mockRejectedValueOnce(
      new Error('Cannot publish store\n- Bank account details')
    );
    render(<SetupChecklistScreen />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /publish store now/i }));

    await waitFor(() => {
      const [, message] = mocks.alert.mock.calls[0] ?? [];
      expect(message).toContain('Cannot publish store');
      expect(message).toContain('Bank account details');
    });
  });

  it('does not show merchant A success after switching to merchant B', async () => {
    let resolvePublish!: () => void;
    mocks.apiClient.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolvePublish = resolve;
      })
    );
    const { rerender } = render(<SetupChecklistScreen />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /publish store now/i }));
    await waitFor(() => expect(mocks.apiClient).toHaveBeenCalledTimes(1));

    mocks.merchant = { id: 'merchant-b' };
    mocks.readiness = readinessFor('merchant-b');
    rerender(<SetupChecklistScreen />);

    await act(async () => resolvePublish());

    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('does not show merchant A failure after switching to merchant B', async () => {
    let rejectPublish!: (error: Error) => void;
    mocks.apiClient.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectPublish = reject;
      })
    );
    const { rerender } = render(<SetupChecklistScreen />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /publish store now/i }));
    await waitFor(() => expect(mocks.apiClient).toHaveBeenCalledTimes(1));

    mocks.merchant = { id: 'merchant-b' };
    mocks.readiness = readinessFor('merchant-b');
    rerender(<SetupChecklistScreen />);

    await act(async () =>
      rejectPublish(new Error('Merchant A publish failed'))
    );

    expect(mocks.alert).not.toHaveBeenCalled();
  });
});
