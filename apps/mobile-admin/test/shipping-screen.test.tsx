import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShippingScreen from '@/app/(admin)/shipping';

type MutationConfig = {
  mutationFn: (variables: unknown) => Promise<void>;
  onError?: (error: unknown) => void;
};

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  mutationConfigs: [] as MutationConfig[],
  update: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: MutationConfig) => {
    mocks.mutationConfigs.push(config);
    return { isPending: false, mutate: vi.fn() };
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
  ProvidersList: () => null,
}));

vi.mock('@/components/shipping/ShippingForm', () => ({
  ShippingForm: () => null,
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
    mocks.mutationConfigs.length = 0;
    mocks.update.mockReset();
    mocks.eq.mockReturnValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ update: mocks.update });
  });

  it('writes exact provider and threshold fields through captured mutations', async () => {
    // Arrange
    render(<ShippingScreen />);
    const [providerMutation, thresholdMutation] = mocks.mutationConfigs;
    if (!providerMutation || !thresholdMutation) {
      throw new Error('Expected both shipping mutations to be captured');
    }

    // Act
    await providerMutation.mutationFn({ providerId: 'topship', enabled: true });
    await thresholdMutation.mutationFn(12500);

    // Assert
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'merchant_feature_settings');
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'merchant_feature_settings');
    expect(mocks.update).toHaveBeenNthCalledWith(1, {
      shipping_providers: ['gigl', 'topship'],
    });
    expect(mocks.update).toHaveBeenNthCalledWith(2, {
      free_shipping_threshold: 12500,
    });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, 'merchant_id', 'merchant-1');
    expect(mocks.eq).toHaveBeenNthCalledWith(2, 'merchant_id', 'merchant-1');
  });

  it('rejects and alerts when persisting a shipping provider fails', async () => {
    // Arrange
    render(<ShippingScreen />);
    const [providerMutation] = mocks.mutationConfigs;
    const persistenceError = new Error('Failed to persist shipping provider');
    mocks.eq.mockReturnValueOnce({ error: persistenceError });
    if (!providerMutation) {
      throw new Error('Expected the shipping provider mutation to be captured');
    }

    // Act
    const mutation = providerMutation.mutationFn({
      providerId: 'topship',
      enabled: true,
    });

    // Assert
    await expect(mutation).rejects.toBe(persistenceError);
    providerMutation.onError?.(persistenceError);
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update shipping provider'
    );
  });

  it('rejects and alerts when persisting the free shipping threshold fails', async () => {
    // Arrange
    render(<ShippingScreen />);
    const [, thresholdMutation] = mocks.mutationConfigs;
    const persistenceError = new Error(
      'Failed to persist free shipping threshold'
    );
    mocks.eq.mockReturnValueOnce({ error: persistenceError });
    if (!thresholdMutation) {
      throw new Error(
        'Expected the free shipping threshold mutation to be captured'
      );
    }

    // Act
    const mutation = thresholdMutation.mutationFn(12500);

    // Assert
    await expect(mutation).rejects.toBe(persistenceError);
    thresholdMutation.onError?.(persistenceError);
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update free shipping threshold'
    );
  });
});
