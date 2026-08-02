import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShippingScreen from '@/app/(admin)/shipping';

type MutationConfig = {
  mutationFn: (variables: unknown) => Promise<void>;
  onError?: (error: unknown, variables: unknown, context?: unknown) => void;
  onMutate?: (variables: unknown) => Promise<unknown>;
  onSettled?: () => void;
};

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: MutationConfig) => {
    return {
      isPending: false,
      mutate: (variables: unknown) => {
        void (async () => {
          const context = await config.onMutate?.(variables);
          try {
            await config.mutationFn(variables);
          } catch (error) {
            config.onError?.(error, variables, context);
          } finally {
            config.onSettled?.();
          }
        })();
      },
    };
  },
  useQuery: () => ({
    data: {
      currency: 'NGN',
      settings: {
        merchant_id: 'merchant-1',
        shipping_providers: ['gigl'],
        free_shipping_threshold: 5000,
      },
    },
    error: null,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    error: null,
    isLoading: false,
    merchant: { id: 'merchant-1', payout_currency: 'NGN' },
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {},
    isDark: false,
    shadows: { sm: {} },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/components/shipping/ProvidersList', () => ({
  ProvidersList: ({
    onToggleProvider,
  }: {
    onToggleProvider: (providerId: 'topship', enabled: boolean) => void;
  }) => (
    <>
      <button
        aria-label="Enable Topship"
        onClick={() => onToggleProvider('topship', true)}
        type="button"
      >
        Enable Topship
      </button>
      <button
        aria-label="Disable Topship"
        onClick={() => onToggleProvider('topship', false)}
        type="button"
      >
        Disable Topship
      </button>
    </>
  ),
}));

vi.mock('@/components/shipping/ShippingForm', () => ({
  ShippingForm: ({
    onSaveThreshold,
    onStartEditing,
    onThresholdChange,
  }: {
    onSaveThreshold: () => void;
    onStartEditing: () => void;
    onThresholdChange: (value: string) => void;
  }) => (
    <>
      <button onClick={onStartEditing} type="button">
        Edit free shipping threshold
      </button>
      <button onClick={() => onThresholdChange('12,500')} type="button">
        Set threshold to 12500
      </button>
      <button onClick={() => onThresholdChange('')} type="button">
        Clear threshold
      </button>
      <button onClick={() => onThresholdChange('-1')} type="button">
        Set threshold to negative one
      </button>
      <button onClick={onSaveThreshold} type="button">
        Save threshold
      </button>
    </>
  ),
}));

vi.mock('@/components/shipping/shipping-styles', () => ({ styles: {} }));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Linking: { openURL: vi.fn() },
  Platform: {
    OS: 'web',
    select: <T,>(values: { default?: T; web?: T }) =>
      values.web ?? values.default,
  },
  Pressable: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ScrollView: ({ children }: { children?: ReactNode }) => <>{children}</>,
  StyleSheet: { create: <T,>(styles: T) => styles },
  StatusBar: () => null,
  Text: ({ children }: { children?: ReactNode }) => <>{children}</>,
  View: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('react-native-reanimated', () => ({}));

describe('ShippingScreen audited settings mutations', () => {
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.eq.mockReset();
    mocks.from.mockReset();
    mocks.update.mockReset();
    mocks.eq.mockReturnValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ update: mocks.update });
  });

  it('persists provider and threshold changes through rendered child controls', async () => {
    // Arrange
    render(<ShippingScreen />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Enable Topship' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit free shipping threshold' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Set threshold to 12500' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save threshold' }));

    // Assert
    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        shipping_providers: ['gigl', 'topship'],
      });
      expect(mocks.update).toHaveBeenCalledWith({
        free_shipping_threshold: 12500,
      });
    });
    expect(mocks.from).toHaveBeenCalledWith('merchant_feature_settings');
    expect(mocks.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('rejects and alerts when persisting a shipping provider fails', async () => {
    // Arrange
    render(<ShippingScreen />);
    const persistenceError = new Error('Failed to persist shipping provider');
    mocks.eq.mockReturnValueOnce({ error: persistenceError });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Enable Topship' }));

    // Assert
    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to update shipping provider'
      );
    });
  });

  it('rejects and alerts when persisting the free shipping threshold fails', async () => {
    // Arrange
    render(<ShippingScreen />);
    const persistenceError = new Error(
      'Failed to persist free shipping threshold'
    );
    mocks.eq.mockReturnValueOnce({ error: persistenceError });

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit free shipping threshold' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Set threshold to 12500' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save threshold' }));

    // Assert
    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to update free shipping threshold'
      );
    });
  });

  it('persists disabling a provider and clearing the free shipping threshold', async () => {
    // Arrange
    render(<ShippingScreen />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Disable Topship' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit free shipping threshold' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear threshold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save threshold' }));

    // Assert
    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        shipping_providers: ['gigl'],
      });
      expect(mocks.update).toHaveBeenCalledWith({
        free_shipping_threshold: null,
      });
    });
  });

  it('rejects a negative free shipping threshold from the rendered control', async () => {
    // Arrange
    render(<ShippingScreen />);

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit free shipping threshold' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Set threshold to negative one' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save threshold' }));

    // Assert
    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Invalid threshold',
        'Enter a valid non-negative amount for free shipping.'
      );
    });
    await Promise.resolve();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
