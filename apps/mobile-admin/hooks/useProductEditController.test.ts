import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeParamsState = vi.hoisted(() => ({
  current: { id: 'new' } as { id: string; sku?: string },
}));

const persistenceState = vi.hoisted(() => ({
  lastParams: null as Record<string, unknown> | null,
}));

const revenueCatState = vi.hoisted(() => ({
  isPro: false,
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => routeParamsState.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: false,
    merchant: { id: 'merch-1', plan_tier: 'free', premium_features: [] },
  }),
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: () => ({
    isPro: revenueCatState.isPro,
  }),
}));

vi.mock('@/hooks/useProductNameSuggestions', () => ({
  useProductNameSuggestions: () => ({ data: [], suggestions: [] }),
}));

vi.mock('@/hooks/useProducts', () => ({
  useCategories: () => ({ data: [] }),
  useCreateCategory: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useInventoryStats: () => ({
    data: { totalProducts: 1000 },
  }),
  useProduct: () => ({ data: undefined, error: null }),
  useUpdateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProductStatus: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-0000-0000-00000000abcd',
}));

vi.mock('./createProductEditImageActions', () => ({
  createProductEditImageActions: () => ({
    handleImagePick: vi.fn(),
  }),
}));

vi.mock('./createProductEditPersistenceActions', () => ({
  createProductEditPersistenceActions: (params: Record<string, unknown>) => {
    persistenceState.lastParams = params;
    return {
      handleCreateCategory: vi.fn(),
      handleSave: vi.fn(),
      handleStatusToggle: vi.fn(),
    };
  },
}));

vi.mock('./createProductEditVariantActions', () => ({
  createProductEditVariantActions: () => ({
    addAttribute: vi.fn(),
    addVariant: vi.fn(),
    addVariantAttribute: vi.fn(),
    adjustStock: vi.fn(),
    removeAttribute: vi.fn(),
    removeVariant: vi.fn(),
    removeVariantAttribute: vi.fn(),
    updateAttribute: vi.fn(),
    updateFulfillmentItem: vi.fn(),
    updateVariant: vi.fn(),
    updateVariantAttribute: vi.fn(),
    updateVariantCondition: vi.fn(),
  }),
}));

import { useProductEditController } from './useProductEditController';

describe('useProductEditController', () => {
  beforeEach(() => {
    persistenceState.lastParams = null;
    revenueCatState.isPro = false;
  });

  it('initialises in new-product mode when id is "new"', () => {
    routeParamsState.current = { id: 'new' };
    const { result } = renderHook(() => useProductEditController());

    expect(result.current.isEditing).toBe(false);
  });

  it('passes the product creation gate to the persistence actions', () => {
    routeParamsState.current = { id: 'new' };
    renderHook(() => useProductEditController());

    expect(persistenceState.lastParams?.productCreationGate).toMatchObject({
      allowed: false,
      limit: 1000,
      requiresUpgrade: true,
    });
  });

  it('allows RevenueCat Pro merchants to create products beyond the free limit', () => {
    revenueCatState.isPro = true;
    routeParamsState.current = { id: 'new' };
    renderHook(() => useProductEditController());

    expect(persistenceState.lastParams?.productCreationGate).toMatchObject({
      allowed: true,
      requiresUpgrade: false,
    });
  });

  it('initialises in edit mode when id is a valid UUID', () => {
    routeParamsState.current = { id: '123e4567-e89b-42d3-a456-426614174000' };
    const { result } = renderHook(() => useProductEditController());

    expect(result.current.isEditing).toBe(true);
  });
});
