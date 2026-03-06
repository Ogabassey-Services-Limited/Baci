import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMerchant: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/supabase-utils', () => ({
  getJoinedRecord: vi.fn(),
}));

vi.mock('./useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

import { useOrder } from './useOrder';

describe('useOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockImplementation((config) => config);
    mocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1' },
    });
  });

  it('keeps the order detail query key stable', () => {
    const { result } = renderHook(() => useOrder('order-1'));
    const query = result.current as unknown as {
      queryKey: string[];
      enabled: boolean;
    };

    expect(query.queryKey).toEqual(['order', 'order-1']);
    expect(query.enabled).toBe(true);
  });

  it('stays disabled until both orderId and merchant are available', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: null,
    });

    const { result } = renderHook(() => useOrder(''));
    const query = result.current as unknown as {
      enabled: boolean;
    };

    expect(query.enabled).toBe(false);
  });
});
