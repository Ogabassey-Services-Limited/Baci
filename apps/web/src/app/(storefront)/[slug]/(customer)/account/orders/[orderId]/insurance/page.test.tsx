import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryLog: [string, string, unknown][] = [];

const mocks = vi.hoisted(() => ({
  getMerchantSafe: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantSafe: (...args: unknown[]) => mocks.getMerchantSafe(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mocks.createClient(...args),
}));

import InsurancePolicyPage from './page';

function createQuery(table: string, result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn((column: string, value: unknown) => {
      queryLog.push([table, column, value]);
      return chain;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    select: vi.fn(() => chain),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable, and this mock intentionally mirrors that contract.
    then: (
      onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain;
}

describe('InsurancePolicyPage', () => {
  beforeEach(() => {
    queryLog.length = 0;
    mocks.getMerchantSafe.mockReset();
    mocks.createClient.mockReset();
  });

  it('rejects non-UUID order params before querying tenant data', async () => {
    const element = await InsurancePolicyPage({
      params: Promise.resolve({ orderId: 'not-a-uuid', slug: 'ogabassey' }),
    });

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getMerchantSafe).not.toHaveBeenCalled();
    expect(queryLog).toEqual([]);
    expect(element).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          initialResult: {
            error: 'No active insurance policy found for this order.',
            policy: null,
          },
        }),
      })
    );
  });

  it('scopes policy loading to the authenticated storefront customer order', async () => {
    const orderId = '11111111-1111-4111-8111-111111111111';

    mocks.getMerchantSafe.mockResolvedValue({
      id: 'merchant-1',
      is_published: true,
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })
        ),
      },
      from: vi.fn((table: string) => {
        if (table === 'customers') {
          return createQuery(table, {
            data: { id: 'customer-1' },
            error: null,
          });
        }
        if (table === 'orders') {
          return createQuery(table, {
            data: { shipping_status: 'delivered' },
            error: null,
          });
        }
        if (table === 'order_insurance_policies') {
          return createQuery(table, {
            data: [
              {
                certificate_url: null,
                claim_comment: null,
                claim_link: 'https://mycover.ai/purchase?q=claim',
                claim_progress: null,
                claim_stage: null,
                claim_status: null,
                coverage_amount: 250000,
                id: 'policy-1',
                inspection_link: null,
                inspection_status: 'completed',
                items_insured: null,
                mycover_policy_number: 'MC-2048',
                policy_expiry_date: '2027-06-25T00:00:00.000Z',
                policy_start_date: '2026-06-25T00:00:00.000Z',
                premium_amount: 2500,
                provider_name: 'Sovereign Trust',
                status: 'active',
              },
            ],
            error: null,
          });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const element = await InsurancePolicyPage({
      params: Promise.resolve({ orderId, slug: 'ogabassey' }),
    });

    expect(mocks.getMerchantSafe).toHaveBeenCalledWith('ogabassey');
    expect(queryLog).toContainEqual(['customers', 'merchant_id', 'merchant-1']);
    expect(queryLog).toContainEqual(['customers', 'user_id', 'user-1']);
    expect(queryLog).toContainEqual(['orders', 'id', orderId]);
    expect(queryLog).toContainEqual(['orders', 'merchant_id', 'merchant-1']);
    expect(queryLog).toContainEqual(['orders', 'customer_id', 'customer-1']);
    expect(queryLog).toContainEqual([
      'order_insurance_policies',
      'order_id',
      orderId,
    ]);
    expect(element).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          initialResult: expect.objectContaining({
            error: '',
            policy: expect.objectContaining({ orderDelivered: true }),
          }),
        }),
      })
    );
  });
});
