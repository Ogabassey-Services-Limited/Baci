import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';
import { useStaffAccounts } from './useStaffAccounts';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  merchant: { id: 'merchant-1' } as { id: string } | null,
  createBranch: vi.fn(),
  getSession: vi.fn(),
  supabaseFrom: vi.fn(),
  directInsert: vi.fn(),
}));

const emptyQueryResult = { data: [], error: null };

function createQuery(result = emptyQueryResult, terminalOrderCall = 1) {
  let orderCalls = 0;
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockImplementation(() => {
    orderCalls += 1;
    return orderCalls === terminalOrderCall ? Promise.resolve(result) : query;
  });

  return query;
}

vi.mock('react-native', () => ({
  StatusBar: () => null,
  Alert: { alert: mocks.alert },
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: mocks.merchant,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/lib/branch-api', () => ({
  createBranch: (...args: unknown[]) => mocks.createBranch(...args),
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://usebaci.com',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mocks.supabaseFrom(table),
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
    },
  },
}));

export function getStaffAccountsMocks() {
  return mocks;
}

export function getUseStaffAccounts() {
  return useStaffAccounts;
}

export function resetStaffAccountsMocks() {
  mocks.alert.mockReset();
  mocks.merchant = { id: 'merchant-1' };
  mocks.createBranch.mockReset();
  mocks.getSession.mockReset();
  mocks.supabaseFrom.mockReset();
  mocks.directInsert.mockReset();
  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === 'branches') {
      return {
        ...createQuery(emptyQueryResult, 2),
        insert: mocks.directInsert,
      };
    }

    return createQuery();
  });
  mocks.createBranch.mockResolvedValue({
    id: '123e4567-e89b-42d3-a456-426614174000',
    merchant_id: '123e4567-e89b-42d3-a456-426614174001',
    name: 'Lagos main',
    address: null,
    city: 'Lagos',
    state: null,
    phone: null,
    manager_id: null,
    is_default: false,
    active: true,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  });
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: 'token-1' } },
    error: null,
  });
}

export function createStaffAccountsWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }

  return { queryClient, Wrapper };
}
