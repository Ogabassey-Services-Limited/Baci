import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import { createNewOrderCustomerActions } from './createNewOrderCustomerActions';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

type CustomerActionsParams = Parameters<
  typeof createNewOrderCustomerActions
>[0];

function makeActions(overrides: Partial<CustomerActionsParams> = {}) {
  return createNewOrderCustomerActions({
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
    ...overrides,
  });
}

describe('createNewOrderCustomerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets the customer modal state on close', () => {
    const setShowCustomerModal = vi.fn();
    const setIsCreatingCustomer = vi.fn();
    const setNewCustomer = vi.fn();
    const setSelectedCountryCode = vi.fn();
    const setDuplicateCustomer = vi.fn();
    const setCustomerSearch = vi.fn();
    const actions = makeActions({
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
    await makeActions().handleCreateCustomer();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Required',
      'First Name and Phone are required'
    );
  });

  it('prefers full names and falls back through email, phone, then unknown when selecting a customer', () => {
    const setCustomer = vi.fn();
    const actions = makeActions({ setCustomer });

    [
      {
        expected: {
          address: '12 Allen Avenue',
          email: 'ada@example.com',
          id: 'customer-1',
          name: 'Ada Lovelace',
          phone: '08012345678',
        },
        input: {
          address: '12 Allen Avenue',
          email: 'ada@example.com',
          first_name: 'Ada',
          id: 'customer-1',
          last_name: 'Lovelace',
          phone: '08012345678',
        },
      },
      {
        expected: {
          address: '',
          email: 'merchant-owner@example.com',
          id: 'customer-2',
          name: 'merchant-owner',
          phone: '',
        },
        input: {
          address: null,
          email: 'merchant-owner@example.com',
          first_name: null,
          id: 'customer-2',
          last_name: null,
          phone: null,
        },
      },
      {
        expected: {
          address: '',
          email: '',
          id: 'customer-3',
          name: '08099999999',
          phone: '08099999999',
        },
        input: {
          address: null,
          email: null,
          first_name: null,
          id: 'customer-3',
          last_name: null,
          phone: '08099999999',
        },
      },
      {
        expected: {
          address: '',
          email: '',
          id: 'customer-4',
          name: 'Unknown',
          phone: '',
        },
        input: {
          address: null,
          email: null,
          first_name: null,
          id: 'customer-4',
          last_name: null,
          phone: null,
        },
      },
    ].forEach(({ expected, input }, index) => {
      actions.handleSelectCustomer(input);
      expect(setCustomer).toHaveBeenNthCalledWith(index + 1, expected);
    });
  });
});
