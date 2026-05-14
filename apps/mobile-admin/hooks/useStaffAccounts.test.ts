import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStaffAccounts } from './useStaffAccounts';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  merchant: { id: 'merchant-1' } as { id: string } | null,
  createBranch: vi.fn(),
  supabaseFrom: vi.fn(),
  directInsert: vi.fn(),
}));

const emptyQueryResult = { data: [], error: null };

function createQuery(result = emptyQueryResult) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };

  return query;
}

vi.mock('react-native', () => ({
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
      getSession: vi.fn(),
    },
  },
}));

function createWrapper() {
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

describe('useStaffAccounts', () => {
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.merchant = { id: 'merchant-1' };
    mocks.createBranch.mockReset();
    mocks.supabaseFrom.mockReset();
    mocks.directInsert.mockReset();
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === 'branches') {
        return {
          ...createQuery(),
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
  });

  it('creates branches through branch-api instead of direct Supabase inserts', async () => {
    const onBranchCreated = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () =>
        useStaffAccounts({
          onAccountCreated: vi.fn(),
          onBranchCreated,
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await result.current.createBranchMutation.mutateAsync({
        name: 'Lagos main',
        city: 'Lagos',
      });
    });

    expect(mocks.createBranch).toHaveBeenCalledWith({
      name: 'Lagos main',
      city: 'Lagos',
      isDefault: false,
    });
    expect(mocks.directInsert).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['branches'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['branch-scope'],
    });
    expect(onBranchCreated).toHaveBeenCalledTimes(1);
  });

  it('surfaces branch API errors without firing the success callback', async () => {
    const onBranchCreated = vi.fn();
    mocks.createBranch.mockRejectedValueOnce(new Error('API down'));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useStaffAccounts({
          onAccountCreated: vi.fn(),
          onBranchCreated,
        }),
      { wrapper: Wrapper }
    );

    await expect(
      act(async () => {
        await result.current.createBranchMutation.mutateAsync({
          name: 'Lagos main',
          city: 'Lagos',
        });
      })
    ).rejects.toThrow('API down');

    expect(onBranchCreated).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'API down');
    });
    expect(mocks.directInsert).not.toHaveBeenCalled();
  });
});
