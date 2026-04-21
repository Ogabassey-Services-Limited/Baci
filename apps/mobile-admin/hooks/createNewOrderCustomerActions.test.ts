import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import type { SelectableCustomer } from '@/components/orders/new-order.types';
import { createNewOrderCustomerActions } from './createNewOrderCustomerActions';

interface DuplicateLookupResponse {
  data: SelectableCustomer | null;
  error: { message: string } | null;
}

const mocks = vi.hoisted(() => {
  const eqCalls: [string, unknown][] = [];
  const isCalls: [string, unknown][] = [];
  const responses: DuplicateLookupResponse[] = [];
  const builder = {
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    is: vi.fn((column: string, value: unknown) => {
      isCalls.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(
      async () => responses.shift() ?? { data: null, error: null }
    ),
    or: vi.fn(),
    select: vi.fn(() => builder),
  };

  return {
    builder,
    eqCalls,
    isCalls,
    maybeSingle: builder.maybeSingle,
    or: builder.or,
    queueResponse(response: DuplicateLookupResponse) {
      responses.push(response);
    },
    reset() {
      eqCalls.length = 0;
      isCalls.length = 0;
      responses.length = 0;
      builder.eq.mockClear();
      builder.is.mockClear();
      builder.maybeSingle.mockClear();
      builder.or.mockClear();
      builder.select.mockClear();
    },
  };
});

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => mocks.builder,
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
    mocks.reset();
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

  it('checks duplicates without using a raw or filter and reuses an existing phone match', async () => {
    const setDuplicateCustomer = vi.fn();
    const createCustomer = vi.fn();
    mocks.queueResponse({
      data: {
        address: '12 Allen Avenue',
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08012345678',
      },
      error: null,
    });

    await makeActions({
      createCustomer,
      newCustomer: {
        address: '',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '08012345678',
      },
      setDuplicateCustomer,
    }).handleCreateCustomer();

    expect(mocks.or).not.toHaveBeenCalled();
    expect(mocks.eqCalls).toEqual([
      ['merchant_id', 'merchant-1'],
      ['phone', '08012345678'],
    ]);
    expect(mocks.isCalls).toEqual([['deleted_at', null]]);
    expect(setDuplicateCustomer).toHaveBeenCalledWith({
      address: '12 Allen Avenue',
      email: 'ada@example.com',
      first_name: 'Ada',
      id: 'customer-1',
      last_name: 'Lovelace',
      phone: '08012345678',
    });
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('falls back to the email duplicate lookup when the phone lookup misses', async () => {
    const setDuplicateCustomer = vi.fn();
    mocks.queueResponse({ data: null, error: null });
    mocks.queueResponse({
      data: {
        address: '12 Allen Avenue',
        email: 'ada@example.com',
        first_name: null,
        id: 'customer-1',
        last_name: null,
        phone: null,
      },
      error: null,
    });

    await makeActions({
      newCustomer: {
        address: '',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: '',
        phone: '08012345678',
      },
      setDuplicateCustomer,
    }).handleCreateCustomer();

    expect(mocks.eqCalls).toEqual([
      ['merchant_id', 'merchant-1'],
      ['phone', '08012345678'],
      ['merchant_id', 'merchant-1'],
      ['email', 'ada@example.com'],
    ]);
    expect(setDuplicateCustomer).toHaveBeenCalledWith({
      address: '12 Allen Avenue',
      email: 'ada@example.com',
      first_name: null,
      id: 'customer-1',
      last_name: null,
      phone: null,
    });
  });

  it('creates and selects a customer when duplicate checks pass', async () => {
    const createCustomer = vi.fn().mockResolvedValue({
      address: '12 Allen Avenue',
      email: 'ada@example.com',
      first_name: 'Ada',
      id: 'customer-99',
      last_name: 'Lovelace',
      phone: '08012345678',
    });
    const setCustomer = vi.fn();
    const setCustomerSearch = vi.fn();
    const setIsCreatingCustomer = vi.fn();
    const setNewCustomer = vi.fn();
    const setShowCustomerModal = vi.fn();

    mocks.queueResponse({ data: null, error: null });
    mocks.queueResponse({ data: null, error: null });

    await makeActions({
      createCustomer,
      newCustomer: {
        address: '12 Allen Avenue',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '08012345678',
      },
      setCustomer,
      setCustomerSearch,
      setIsCreatingCustomer,
      setNewCustomer,
      setShowCustomerModal,
    }).handleCreateCustomer();

    expect(createCustomer).toHaveBeenCalledWith({
      address: '12 Allen Avenue',
      email: 'ada@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '08012345678',
    });
    expect(setCustomer).toHaveBeenCalledWith({
      address: '12 Allen Avenue',
      email: 'ada@example.com',
      id: 'customer-99',
      name: 'Ada Lovelace',
      phone: '08012345678',
    });
    expect(setShowCustomerModal).toHaveBeenCalledWith(false);
    expect(setCustomerSearch).toHaveBeenCalledWith('');
    expect(setIsCreatingCustomer).toHaveBeenCalledWith(false);
    expect(setNewCustomer).toHaveBeenCalled();
  });

  it('aborts customer creation when duplicate lookup fails', async () => {
    const createCustomer = vi.fn();
    mocks.queueResponse({
      data: null,
      error: { message: 'lookup failed' },
    });

    await makeActions({
      createCustomer,
      newCustomer: {
        address: '',
        email: '',
        firstName: 'Ada',
        lastName: '',
        phone: '08012345678',
      },
    }).handleCreateCustomer();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Unable to check for existing customers right now.'
    );
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('surfaces a safe fallback message when createCustomer throws a non-Error value', async () => {
    await makeActions({
      createCustomer: vi.fn().mockRejectedValue('boom'),
      newCustomer: {
        address: '',
        email: '',
        firstName: 'Ada',
        lastName: '',
        phone: '08012345678',
      },
    }).handleCreateCustomer();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Unable to create customer right now.'
    );
  });
});
