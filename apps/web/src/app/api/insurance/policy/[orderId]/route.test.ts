import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

const mockFrom = vi.fn();
const mockAuthGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockAuthGetUser },
      from: mockFrom,
    })
  ),
}));

// Import after mocks
import { GET } from './route';

// ---- Helpers ----

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_ORDER_ID = '22222222-2222-4222-8222-222222222222';

function createMockRequest(orderId = ORDER_ID): NextRequest {
  return new Request(`http://localhost:3000/api/insurance/policy/${orderId}`, {
    method: 'GET',
  }) as unknown as NextRequest;
}

function createParams(orderId: string): {
  params: Promise<{ orderId: string }>;
} {
  return { params: Promise.resolve({ orderId }) };
}

/**
 * Wire the supabase mock for both tables the route reads:
 * `order_insurance_policies` (the policies) and `orders` (shipping status).
 */
function mockDb({
  customerRows = [{ id: 'customer-1' }] as Array<{ id: string }>,
  customersError = null as unknown,
  policies = [] as unknown[],
  policiesError = null as unknown,
  shippingStatus = 'delivered' as string | null,
  ordersError = null as unknown,
  orderCustomerId = 'customer-1',
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'customers') {
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: customerRows,
              error: customersError,
            }),
        }),
      };
    }
    if (table === 'orders') {
      // Enforce the ownership scope: the order row is only returned when the
      // route filters by the requested orderId AND the caller's customer ids.
      // A regression that drops either filter makes maybeSingle resolve null.
      const expectedCustomerIds = customerRows.map((row) => row.id);
      let scopedById = false;
      let scopedByCustomer = false;
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            scopedById = column === 'id' && value === ORDER_ID;
            return {
              in: (column2: string, values: unknown) => {
                scopedByCustomer =
                  column2 === 'customer_id' &&
                  Array.isArray(values) &&
                  values.length === expectedCustomerIds.length &&
                  expectedCustomerIds.every((id) => values.includes(id));
                return {
                  maybeSingle: () =>
                    Promise.resolve({
                      data:
                        scopedById &&
                        scopedByCustomer &&
                        shippingStatus !== null
                          ? {
                              customer_id: orderCustomerId,
                              shipping_status: shippingStatus,
                            }
                          : null,
                      error: ordersError,
                    }),
                };
              },
            };
          },
        }),
      };
    }
    // order_insurance_policies
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: policies, error: policiesError }),
      }),
    };
  });
}

// ---- Test Data ----

const mockPolicyRow = {
  id: 'policy-db-1',
  order_id: ORDER_ID,
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
  claim_link: 'https://mycover.ai/purchase?q=claim-token',
  inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
  inspection_status: 'pending',
};

const mockSecondPolicyRow = {
  id: 'policy-db-2',
  order_id: ORDER_ID,
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
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('returns 401 before reading policy data when the customer is not authenticated', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await GET(createMockRequest(), createParams(ORDER_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects invalid order id params before database reads', async () => {
    const response = await GET(
      createMockRequest('not-a-valid-order-id'),
      createParams('not-a-valid-order-id')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid order id' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns found false when the session has no linked customer rows', async () => {
    mockDb({ customerRows: [], policies: [mockPolicyRow] });

    const response = await GET(createMockRequest(), createParams(ORDER_ID));
    const body = await response.json();

    expect(body).toEqual({ found: false, policies: [] });
  });

  it('returns 500 when customer scoping lookup fails', async () => {
    mockDb({
      customersError: { message: 'customer lookup failed' },
      policies: [mockPolicyRow],
    });

    const response = await GET(createMockRequest(), createParams(ORDER_ID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to fetch customer context' });
  });

  describe('v2 response contract: array format', () => {
    it('returns { found: true, policies: [...] } when policies exist (array, not singular)', async () => {
      mockDb({ policies: [mockPolicyRow] });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      // v2: response must be `policies` (array), NOT `policy` (object)
      expect(body).toHaveProperty('found', true);
      expect(body).toHaveProperty('policies');
      expect(Array.isArray(body.policies)).toBe(true);
      expect(body).not.toHaveProperty('policy');
    });

    it('returns multiple policies in the array when order has several', async () => {
      mockDb({ policies: [mockPolicyRow, mockSecondPolicyRow] });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.found).toBe(true);
      expect(body.policies).toHaveLength(2);
    });

    it('returns { found: false, policies: [] } when no policies exist', async () => {
      mockDb({ policies: [] });

      const response = await GET(
        createMockRequest(),
        createParams(MISSING_ORDER_ID)
      );
      const body = await response.json();

      expect(body).toHaveProperty('found', false);
      expect(body).toHaveProperty('policies');
      expect(body.policies).toEqual([]);
    });
  });

  describe('v2 policy shape', () => {
    it('each policy has policyType field', async () => {
      mockDb({ policies: [mockPolicyRow] });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0]).toHaveProperty('policyType');
    });

    it('each policy has policyNumber from DB', async () => {
      mockDb({ policies: [mockPolicyRow] });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].policyNumber).toBe('POL-2024-001');
    });

    it('provider comes from DB provider_name, not hardcoded', async () => {
      mockDb({
        policies: [
          { ...mockPolicyRow, provider_name: 'AXA Mansard Insurance' },
        ],
      });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      // v2: provider must come from DB `provider_name` column, NOT hardcoded
      expect(body.policies[0].provider).toBe('AXA Mansard Insurance');
      expect(body.policies[0].provider).not.toBe('Sovereign Trust Insurance');
    });

    it('each policy has certificateUrl from DB', async () => {
      mockDb({ policies: [mockPolicyRow] });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].certificateUrl).toBe(
        'https://mycover.ai/certificates/POL-2024-001.pdf'
      );
    });

    it('each policy has all required v2 fields', async () => {
      mockDb({ policies: [mockPolicyRow] });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
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

    it('exposes hosted claimLink and inspectionLink from DB', async () => {
      mockDb({ policies: [mockPolicyRow] });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].claimLink).toBe(
        'https://mycover.ai/purchase?q=claim-token'
      );
      expect(body.policies[0].inspectionLink).toBe(
        'https://mycover.ai/purchase?q=inspection-token'
      );
    });

    it('preserves nullable legacy inspectionStatus values', async () => {
      mockDb({
        policies: [
          mockPolicyRow,
          { ...mockPolicyRow, inspection_status: null },
        ],
      });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].inspectionStatus).toBe('pending');
      expect(body.policies[1].inspectionStatus).toBeNull();
    });

    it('surfaces rich claim state (stage, progress, decline reason)', async () => {
      mockDb({
        policies: [
          {
            ...mockPolicyRow,
            claim_status: 'declined',
            claim_stage: 'Declined',
            claim_progress: 'status',
            claim_comment: 'Outside coverage window',
          },
        ],
      });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].claimStage).toBe('Declined');
      expect(body.policies[0].claimProgress).toBe('status');
      expect(body.policies[0].claimComment).toBe('Outside coverage window');
    });

    it('reflects a completed inspection status', async () => {
      mockDb({
        policies: [{ ...mockPolicyRow, inspection_status: 'completed' }],
      });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].inspectionStatus).toBe('completed');
    });

    it('returns null links when columns are absent', async () => {
      mockDb({
        policies: [
          { ...mockPolicyRow, claim_link: null, inspection_link: null },
        ],
      });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].claimLink).toBeNull();
      expect(body.policies[0].inspectionLink).toBeNull();
    });
  });

  describe('order delivery gating', () => {
    it('marks orderDelivered true when the order is delivered', async () => {
      mockDb({ policies: [mockPolicyRow], shippingStatus: 'delivered' });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].orderDelivered).toBe(true);
    });

    it('treats a completed order as delivered', async () => {
      mockDb({ policies: [mockPolicyRow], shippingStatus: 'completed' });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].orderDelivered).toBe(true);
    });

    it('marks orderDelivered false when the order is not yet delivered', async () => {
      mockDb({ policies: [mockPolicyRow], shippingStatus: 'shipped' });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body.policies[0].orderDelivered).toBe(false);
    });

    it('marks orderDelivered false when the order row is missing', async () => {
      mockDb({ policies: [mockPolicyRow], shippingStatus: null });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));
      const body = await response.json();

      expect(body).toEqual({ found: false, policies: [] });
    });

    it('returns 500 when the orders delivery lookup fails', async () => {
      mockDb({
        policies: [mockPolicyRow],
        ordersError: { message: 'orders read failed' },
      });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));

      expect(response.status).toBe(500);
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected errors', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected DB crash');
      });

      const response = await GET(createMockRequest(), createParams(ORDER_ID));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });
  });
});
