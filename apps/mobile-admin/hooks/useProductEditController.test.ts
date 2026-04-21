import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const routeParamsState = vi.hoisted(() => ({
  current: { id: 'new' } as { id: string; sku?: string },
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => routeParamsState.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: false,
    merchant: { id: 'merch-1' },
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
  createProductEditPersistenceActions: () => ({
    handleCreateCategory: vi.fn(),
    handleSave: vi.fn(),
    handleStatusToggle: vi.fn(),
  }),
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
  it('initialises in new-product mode when id is "new"', () => {
    routeParamsState.current = { id: 'new' };
    const { result } = renderHook(() => useProductEditController());

    expect(result.current.isEditing).toBe(false);
  });

  it('initialises in edit mode when id is a valid UUID', () => {
    routeParamsState.current = { id: '123e4567-e89b-42d3-a456-426614174000' };
    const { result } = renderHook(() => useProductEditController());

    expect(result.current.isEditing).toBe(true);
  });
});
