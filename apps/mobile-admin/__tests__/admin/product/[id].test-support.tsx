import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { TestText } from './[id].native-test-support';

const hoistedMocks = vi.hoisted(() => ({
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
    useLocalSearchParams: hoistedMocks.useLocalSearchParams,
    useRouter: () => hoistedMocks.router,
  };
});

vi.mock('@/components/product/ProductBasicInformationCard', () => ({
  ProductBasicInformationCard: ({
    hideColorField,
  }: {
    hideColorField?: boolean;
  }) => {
    hoistedMocks.basicInformationCardProps.push({ hideColorField });
    return <TestText>{`hide-color-field:${String(hideColorField)}`}</TestText>;
  },
}));

vi.mock('@/components/product/ProductDeleteSection', () => ({
  ProductDeleteSection: () => <TestText>product-delete-section</TestText>,
}));

vi.mock('@/components/ui/InvalidRouteScreen', () => ({
  InvalidRouteScreen: () => (
    <div>
      <TestText>invalid route</TestText>
    </div>
  ),
}));

vi.mock('@/components/ui/KeyboardAwareModalContainer', () => ({
  KeyboardAwareModalContainer: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: () => (
    <div>
      <TestText>safe-image</TestText>
    </div>
  ),
}));

vi.mock('@/components/product/VariantConditionEditor', () => ({
  VariantConditionEditor: () => (
    <div>
      <TestText>variant-condition-editor</TestText>
    </div>
  ),
}));

vi.mock('@/components/product/ProductRestockSheet', () => ({
  ProductRestockSheet: ({
    onClose,
    visible = true,
  }: {
    onClose: () => void;
    visible?: boolean;
  }) =>
    visible ? (
      <div>
        <TestText>product-restock-sheet</TestText>
        <button
          aria-label="Close restock sheet"
          onClick={onClose}
          type="button"
        />
      </div>
    ) : null,
}));

vi.mock('@/components/product/VariantInventoryUnitsSheet', () => ({
  VariantInventoryUnitsSheet: ({
    onClose,
    visible = true,
  }: {
    onClose: () => void;
    visible?: boolean;
  }) =>
    visible ? (
      <div>
        <TestText>variant-inventory-units-sheet</TestText>
        <button
          aria-label="Close units sheet"
          onClick={onClose}
          type="button"
        />
      </div>
    ) : null,
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
  useInventoryStats: () => ({ data: { totalProducts: 0 } }),
  useProduct: hoistedMocks.useProduct,
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

export const baseProduct = {
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

export function getProductEditScreenMocks() {
  return hoistedMocks;
}

export function resetProductEditScreenMocks() {
  vi.clearAllMocks();
  hoistedMocks.basicInformationCardProps.length = 0;
  hoistedMocks.useLocalSearchParams.mockReturnValue({
    id: '123e4567-e89b-42d3-a456-426614174000',
  });
  hoistedMocks.useProduct.mockReturnValue({
    data: {
      ...baseProduct,
      has_variants: true,
    },
    error: null,
  });
}

export async function loadProductEditScreen() {
  return (await import('@/app/(admin)/product/[id]')).default;
}
