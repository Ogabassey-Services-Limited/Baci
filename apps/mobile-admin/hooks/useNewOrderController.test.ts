import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const merchantState = vi.hoisted(() => ({
  current: null as null | {
    id?: string;
    payout_currency?: string | null;
    vat_rate?: number | null;
    vat_registration_status?: string | null;
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: merchantState.current }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: {}, shadows: {} }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCreateCustomer: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('./useNewOrderLookupData', () => ({
  useNewOrderLookupData: () => ({
    customersData: [],
    customersQuery: {},
    productPicker: {
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      products: [],
      refetch: vi.fn(),
    },
    selectedParentProductVariantsQuery: {
      data: [],
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    },
  }),
}));

vi.mock('./useNewOrderUiState', () => ({
  useNewOrderUiState: () => ({
    customItem: { name: '', price: '' },
    setCustomItem: vi.fn(),
    setShowCustomItemModal: vi.fn(),
    setShowProductModal: vi.fn(),
    showCustomItemModal: false,
    showProductModal: false,
  }),
}));

vi.mock('./submitNewOrder', () => ({
  submitNewOrder: vi.fn(),
}));

vi.mock('./createNewOrderCustomerActions', () => ({
  createNewOrderCustomerActions: () => ({
    handleCloseCustomerModal: vi.fn(),
    handleCreateCustomer: vi.fn(),
    handleSelectCustomer: vi.fn(),
    resetNewCustomerForm: vi.fn(),
  }),
}));

vi.mock('./createNewOrderProductActions', () => ({
  createNewOrderProductActions: () => ({
    closeProductModal: vi.fn(),
    handleAddCustomItem: vi.fn(),
    handleAddProduct: vi.fn(),
    handleQuantityChange: vi.fn(),
    handleSelectProduct: vi.fn(),
    resetProductPickerState: vi.fn(),
  }),
}));

vi.mock('@/lib/new-order-totals', () => ({
  createNewOrderTotals: () => ({
    calculatedVat: 0,
    formatPrice: (n: number) => `₦${n}`,
    subtotal: 0,
    taxesToUse: 0,
    total: 0,
    vatRate: 0,
  }),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-0000-0000-000000000001',
}));

vi.mock('expo-router', () => ({
  router: { replace: vi.fn() },
}));

vi.mock('react-native-country-picker-modal', () => ({}));

import { useNewOrderController } from './useNewOrderController';

describe('useNewOrderController', () => {
  it('returns initial default state', () => {
    merchantState.current = null;
    const { result } = renderHook(() => useNewOrderController());

    expect(result.current.selectedChannel).toBe('physical');
    expect(result.current.orderItems).toEqual([]);
    expect(result.current.paymentStatus).toBe('unpaid');
  });

  it('enables VAT when merchant has vat_registration_status registered', async () => {
    merchantState.current = {
      id: 'merchant-1',
      payout_currency: 'NGN',
      vat_rate: 7.5,
      vat_registration_status: 'registered',
    };
    const { result } = renderHook(() => useNewOrderController());

    await waitFor(() => {
      expect(result.current.isVatApplied).toBe(true);
    });
  });
});
