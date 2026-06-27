import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fetchLatestInsurancePolicy,
  fetchOrderCanCancel,
  fetchOrderRecord,
} from './order-details-data';

type RpcResult = { data: boolean | null; error: Error | null };
type OrderResult = { data: unknown; error: Error | null };
type PolicyResult = { data: unknown[]; error: Error | null };

const mockRpc = jest.fn<() => Promise<RpcResult>>();
const mockOrderSingle = jest.fn<() => Promise<OrderResult>>();
const mockPolicyLimit = jest.fn<() => Promise<PolicyResult>>();
const mockPolicySelect = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), error: jest.fn(), warn: jest.fn() }),
}));

jest.mock('./order-details.helpers', () => ({
  mapOrderDetails: (raw: unknown) => raw,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      void args;
      return mockRpc();
    },
    from: (table: string) =>
      table === 'orders'
        ? {
            select: () => ({
              eq: () => ({ eq: () => ({ single: () => mockOrderSingle() }) }),
            }),
          }
        : {
            select: (columns: string) => {
              mockPolicySelect(columns);
              return {
                eq: () => ({
                  order: () => ({ limit: () => mockPolicyLimit() }),
                }),
              };
            },
          },
  },
}));

describe('order-details-data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchOrderCanCancel', () => {
    it('returns true when the RPC resolves true', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      await expect(fetchOrderCanCancel('order-1')).resolves.toBe(true);
    });

    it('returns false when the RPC resolves false', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });
      await expect(fetchOrderCanCancel('order-1')).resolves.toBe(false);
    });

    it('fails closed (false) when the RPC errors', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('boom') });
      await expect(fetchOrderCanCancel('order-1')).resolves.toBe(false);
    });
  });

  describe('fetchOrderRecord', () => {
    it('maps and returns the fetched order', async () => {
      mockOrderSingle.mockResolvedValue({
        data: { id: 'order-1' },
        error: null,
      });
      await expect(fetchOrderRecord('order-1', 'cust-1')).resolves.toEqual({
        id: 'order-1',
      });
    });

    it('throws when the order fetch errors', async () => {
      mockOrderSingle.mockResolvedValue({
        data: null,
        error: new Error('not found'),
      });
      await expect(fetchOrderRecord('order-1', 'cust-1')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('fetchLatestInsurancePolicy', () => {
    it('returns the latest policy when present', async () => {
      mockPolicyLimit.mockResolvedValue({
        data: [{ mycover_policy_number: 'POL-1' }],
        error: null,
      });
      await expect(fetchLatestInsurancePolicy('order-1')).resolves.toEqual({
        mycover_policy_number: 'POL-1',
      });
      expect(mockPolicySelect).toHaveBeenCalledWith(
        expect.stringContaining('claim_progress')
      );
    });

    it('returns null when there are no policies', async () => {
      mockPolicyLimit.mockResolvedValue({ data: [], error: null });
      await expect(fetchLatestInsurancePolicy('order-1')).resolves.toBeNull();
    });

    it('returns null when the policy fetch errors', async () => {
      mockPolicyLimit.mockResolvedValue({
        data: [],
        error: new Error('rls'),
      });
      await expect(fetchLatestInsurancePolicy('order-1')).resolves.toBeNull();
    });
  });
});
