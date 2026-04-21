import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import { createNewOrderCustomerActions } from './createNewOrderCustomerActions';

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  or: vi.fn(),
  select: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      eq: () => ({
        or: mocks.or,
        select: mocks.select,
      }),
      select: mocks.select,
    }),
  },
}));

describe('createNewOrderCustomerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.select.mockReturnValue({
      eq: () => ({ or: mocks.or }),
    });
    mocks.or.mockReturnValue({
      limit: mocks.limit,
    });
    mocks.limit.mockResolvedValue({ data: [], error: null });
  });

  it('resets the customer modal state on close', () => {
    const setShowCustomerModal = vi.fn();
    const setIsCreatingCustomer = vi.fn();
    const setNewCustomer = vi.fn();
    const setSelectedCountryCode = vi.fn();
    const setDuplicateCustomer = vi.fn();
    const setCustomerSearch = vi.fn();
    const actions = createNewOrderCustomerActions({
      createCustomer: vi.fn(),
      merchantId: 'merchant-1',
      newCustomer: createEmptyNewCustomerDraft(),
      setCustomer: vi.fn(),
      setCustomerSearch,
      setDuplicateCustomer,
      setIsCreatingCustomer,
      setNewCustomer,
      setSelectedCountryCode,
      setShowCustomerModal,
    });

    actions.handleCloseCustomerModal();

    expect(setShowCustomerModal).toHaveBeenCalledWith(false);
    expect(setIsCreatingCustomer).toHaveBeenCalledWith(false);
    expect(setSelectedCountryCode).toHaveBeenCalledWith('NG');
    expect(setDuplicateCustomer).toHaveBeenCalledWith(null);
    expect(setCustomerSearch).toHaveBeenCalledWith('');
  });

  it('requires first name and phone before creating a customer', async () => {
    const actions = createNewOrderCustomerActions({
      createCustomer: vi.fn(),
      merchantId: 'merchant-1',
      newCustomer: createEmptyNewCustomerDraft(),
      setCustomer: vi.fn(),
      setCustomerSearch: vi.fn(),
      setDuplicateCustomer: vi.fn(),
      setIsCreatingCustomer: vi.fn(),
      setNewCustomer: vi.fn(),
      setSelectedCountryCode: vi.fn(),
      setShowCustomerModal: vi.fn(),
    });

    await actions.handleCreateCustomer();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Required',
      'First Name and Phone are required'
    );
  });
});
