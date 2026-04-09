import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({})),
}));

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Import after mocks
import { GET } from './route';

// ---- Helpers ----

function createMockRequest(): NextRequest {
  return new Request('http://localhost:3000/api/insurance/policy/order-123', {
    method: 'GET',
  }) as unknown as NextRequest;
}

function createParams(orderId: string): {
  params: Promise<{ orderId: string }>;
} {
  return { params: Promise.resolve({ orderId }) };
}

// ---- Test Data ----

const mockPolicyRow = {
  id: 'policy-db-1',
  order_id: 'order-123',
  mycover_policy_number: 'POL-2024-001',
  status: 'active',
  policy_start_date: '2024-01-01',
  policy_expiry_date: '2024-12-31',
  premium_amount: 25000,
  coverage_amount: 500000,
  items_insured: [{ description: 'iPhone 15 Pro', value: 500000, quantity: 1 }],
  claim_status: 'pending',
  certificate_url: 'https://mycover.ai/certificates/POL-2024-001.pdf',
  provider_name: 'Sovereign Trust Insurance Plc',
  policy_type: 'gadget',
};

const mockSecondPolicyRow = {
  id: 'policy-db-2',
  order_id: 'order-123',
  mycover_policy_number: 'POL-2024-002',
  status: 'active',
  policy_start_date: '2024-02-01',
  policy_expiry_date: '2025-01-31',
  premium_amount: 17000,
  coverage_amount: 1200000,
  items_insured: [{ description: 'MacBook Pro', value: 1200000, quantity: 1 }],
  claim_status: null,
  certificate_url: 'https://mycover.ai/certificates/POL-2024-002.pdf',
  provider_name: 'Sovereign Trust Insurance Plc',
  policy_type: 'git',
};

// ---- Tests ----

describe('GET /api/insurance/policy/[orderId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('v2 response contract: array format', () => {
    it('returns { found: true, policies: [...] } when policies exist (array, not singular)', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => Promise.resolve({ data: [mockPolicyRow], error: null }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );
      const body = await response.json();

      // v2: response must be `policies` (array), NOT `policy` (object)
      expect(body).toHaveProperty('found', true);
      expect(body).toHaveProperty('policies');
      expect(Array.isArray(body.policies)).toBe(true);
      expect(body).not.toHaveProperty('policy');
    });

    it('returns multiple policies in the array when order has several', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [mockPolicyRow, mockSecondPolicyRow],
              error: null,
            }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );
      const body = await response.json();

      expect(body.found).toBe(true);
      expect(body.policies).toHaveLength(2);
    });

    it('returns { found: false, policies: [] } when no policies exist', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
          // Also handle .single() fallback for current code path
          single: () =>
            Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'not found' },
            }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-999')
      );
      const body = await response.json();

      expect(body).toHaveProperty('found', false);
      expect(body).toHaveProperty('policies');
      expect(body.policies).toEqual([]);
    });
  });

  describe('v2 policy shape', () => {
    it('each policy has policyType field', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => Promise.resolve({ data: [mockPolicyRow], error: null }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );
      const body = await response.json();

      expect(body.policies[0]).toHaveProperty('policyType');
    });

    it('each policy has policyNumber from DB', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => Promise.resolve({ data: [mockPolicyRow], error: null }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );
      const body = await response.json();

      expect(body.policies[0].policyNumber).toBe('POL-2024-001');
    });

    it('provider comes from DB provider_name, not hardcoded', async () => {
      const customProviderPolicy = {
        ...mockPolicyRow,
        provider_name: 'AXA Mansard Insurance',
      };

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () =>
            Promise.resolve({ data: [customProviderPolicy], error: null }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );
      const body = await response.json();

      // v2: provider must come from DB `provider_name` column, NOT hardcoded
      expect(body.policies[0].provider).toBe('AXA Mansard Insurance');
      expect(body.policies[0].provider).not.toBe('Sovereign Trust Insurance');
    });

    it('each policy has certificateUrl from DB', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => Promise.resolve({ data: [mockPolicyRow], error: null }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );
      const body = await response.json();

      expect(body.policies[0].certificateUrl).toBe(
        'https://mycover.ai/certificates/POL-2024-001.pdf'
      );
    });

    it('each policy has all required v2 fields', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => Promise.resolve({ data: [mockPolicyRow], error: null }),
        }),
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );
      const body = await response.json();

      const policy = body.policies[0];
      expect(policy).toHaveProperty('policyType');
      expect(policy).toHaveProperty('policyNumber');
      expect(policy).toHaveProperty('provider');
      expect(policy).toHaveProperty('certificateUrl');
      expect(policy).toHaveProperty('status');
      expect(policy).toHaveProperty('startDate');
      expect(policy).toHaveProperty('expiryDate');
      expect(policy).toHaveProperty('premium');
      expect(policy).toHaveProperty('coverage');
      expect(policy).toHaveProperty('itemsInsured');
      expect(policy).toHaveProperty('claimStatus');
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected errors', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected DB crash');
      });

      const response = await GET(
        createMockRequest(),
        createParams('order-123')
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });
  });
});
