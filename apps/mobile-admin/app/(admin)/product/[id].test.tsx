import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  basicInformationCardProps: [] as Array<{ hideColorField?: boolean }>,
  router: {
    back: vi.fn(),
    push: vi.fn(),
  },
  useLocalSearchParams: vi.fn(),
  useProduct: vi.fn(),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');

  return {
    Stack: {
      Screen: ({
        options,
      }: {
        options?: {
          title?: string;
          headerLeft?: () => ReactNode;
          headerRight?: () => ReactNode;
        };
      }) =>
        React.createElement(
          'div',
          null,
          options?.title
            ? React.createElement('span', null, options.title)
            : null,
          options?.headerLeft ? options.headerLeft() : null,
          options?.headerRight ? options.headerRight() : null
        ),
    },
    useLocalSearchParams: mocks.useLocalSearchParams,
    useRouter: () => mocks.router,
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: vi.fn() },
  FlatList: ({
    ListEmptyComponent,
    data,
    renderItem,
  }: {
    ListEmptyComponent?: ReactNode;
    data?: unknown[];
    renderItem?: (args: { item: unknown; index: number }) => ReactNode;
  }) => (
    <div>
      {Array.isArray(data) && data.length > 0
        ? data.map((item, index) => (
            <div key={index}>{renderItem?.({ item, index })}</div>
          ))
        : ListEmptyComponent}
    </div>
  ),
  KeyboardAvoidingView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  Modal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible?: boolean;
  }) => (visible ? <div>{children}</div> : null),
  Platform: { OS: 'ios' },
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
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Switch: ({
    onValueChange,
    value,
  }: {
    onValueChange?: (value: boolean) => void;
    value?: boolean;
  }) => (
    <input
      aria-label="switch"
      checked={Boolean(value)}
      onChange={(event) => onValueChange?.(event.target.checked)}
      type="checkbox"
    />
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (value: string) => void;
    value?: string | number;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/product/ProductBasicInformationCard', () => ({
  ProductBasicInformationCard: ({
    hideColorField,
  }: {
    hideColorField?: boolean;
  }) => {
    mocks.basicInformationCardProps.push({ hideColorField });
    return (
      <div>
        <span>basic-card</span>
        <span>hide-color-field:{String(hideColorField)}</span>
      </div>
    );
  },
}));

vi.mock('@/components/ui/InvalidRouteScreen', () => ({
  InvalidRouteScreen: () => <div>invalid route</div>,
}));

vi.mock('@/components/ui/KeyboardAwareModalContainer', () => ({
  KeyboardAwareModalContainer: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: () => <div>safe-image</div>,
}));

vi.mock('./VariantConditionEditor', () => ({
  VariantConditionEditor: () => <div>variant-condition-editor</div>,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: false,
    merchant: {
      id: 'merchant-1',
      payout_currency: 'NGN',
    },
  }),
}));

vi.mock('@/hooks/useProductNameSuggestions', () => ({
  useProductNameSuggestions: () => ({
    data: [],
  }),
}));

vi.mock('@/hooks/useProducts', () => ({
  useCategories: () => ({ data: [] }),
  useCreateCategory: () => ({ isPending: false, mutate: vi.fn() }),
  useCreateProduct: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useProduct: mocks.useProduct,
  useUpdateProduct: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateProductStatus: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      error: '#ef4444',
      inputBg: '#0f172a',
      primary: '#3b82f6',
      success: '#22c55e',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
    },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
}));

import ProductEditScreen from '@/app/(admin)/product/[id]';

const baseProduct = {
  brand: 'Baci',
  category: 'Phones',
  category_id: 'category-1',
  color: 'Midnight Blue',
  cost_price: 1200,
  description: '<p>Flagship phone</p>',
  fulfillment_details: { items: [] },
  images: [],
  low_stock_threshold: 3,
  manage_stock: true,
  name: 'Phone Ultra',
  price: 1500,
  sku: 'SKU-123',
  status: 'active',
  stock_quantity: 10,
  variant_attributes: {},
  variants: [],
};

describe('ProductEditScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.basicInformationCardProps.length = 0;
    mocks.useLocalSearchParams.mockReturnValue({
      id: '123e4567-e89b-42d3-a456-426614174000',
    });
    mocks.useProduct.mockReturnValue({
      data: {
        ...baseProduct,
        has_variants: true,
      },
      error: null,
    });
  });

  it('hides the color field in basic information when the loaded product uses variants', async () => {
    render(<ProductEditScreen />);

    expect(screen.getByText('basic-card')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('hide-color-field:true')).toBeInTheDocument();
    });

    expect(mocks.basicInformationCardProps.at(-1)?.hideColorField).toBe(true);
  });

  it('shows the color field in basic information when the loaded product does not use variants', async () => {
    mocks.useProduct.mockReturnValue({
      data: {
        ...baseProduct,
        has_variants: false,
      },
      error: null,
    });

    render(<ProductEditScreen />);

    expect(screen.getByText('basic-card')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('hide-color-field:false')).toBeInTheDocument();
    });

    expect(mocks.basicInformationCardProps.at(-1)?.hideColorField).toBe(false);
  });
});
