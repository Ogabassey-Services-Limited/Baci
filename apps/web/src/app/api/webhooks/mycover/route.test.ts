import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  dedupDelete: vi.fn(),
  dedupInsert: vi.fn(),
  dedupSelect: vi.fn(),
  dedupUpdate: vi.fn(),
  fetch: vi.fn(),
  getMyCoverWebhookSecret: vi.fn(),
  maybeNotifyActivateProtection: vi.fn(),
  policyEq: vi.fn(),
  policySelect: vi.fn(),
  policyUpdate: vi.fn(),
}));

vi.mock('@/env', () => ({
  getMyCoverSecretKey: () =>
    process.env.MYCOVER_SECRET_KEY?.trim() || undefined,
  getMyCoverWebhookSecret: () => mocks.getMyCoverWebhookSecret(),
}));

vi.mock('@/lib/insurance/notify-activate-protection', () => ({
  maybeNotifyActivateProtection: (...args: unknown[]) =>
    mocks.maybeNotifyActivateProtection(...args),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mocks.createServiceClient(),
}));

import { POST } from '@/app/api/webhooks/mycover/route';

function signPayload(rawBody: string, secret: string) {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}

function createRequest(body: Record<string, unknown>, signature?: string) {
  const rawBody = JSON.stringify(body);
  return new NextRequest('https://usebaci.com/api/webhooks/mycover', {
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'x-mycoverai-signature': signature } : {}),
    },
    method: 'POST',
  });
}

function createSupabaseMock({
  policyUpdateResult = { data: { id: 'policy-row' }, error: null },
  policySelectResult = {
    data: { inspection_link: null, inspection_status: null },
    error: null,
  } as { data: unknown; error: unknown },
  dedupDeleteResult = { error: null } as { error: unknown },
  dedupInsertResult = { error: null } as { error: unknown },
  dedupSelectResult = {
    data: { processing_status: 'processed' },
    error: null,
  } as { data: unknown; error: unknown },
  dedupUpdateResult = {
    data: { processing_status: 'processed' },
    error: null,
  } as {
    data: unknown;
    error: unknown;
  },
}: {
  policyUpdateResult?: { data: unknown; error: unknown };
  policySelectResult?: { data: unknown; error: unknown };
  dedupDeleteResult?: { error: unknown };
  dedupInsertResult?: { error: unknown };
  dedupSelectResult?: { data: unknown; error: unknown };
  dedupUpdateResult?: { data: unknown; error: unknown };
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'mycover_webhook_events') {
        return {
          delete: vi.fn(() => {
            const chain = {
              eq: vi.fn((column: string, value: string) => {
                mocks.dedupDelete(column, value);
                return chain;
              }),
              // biome-ignore lint/suspicious/noThenProperty: Supabase delete builders are awaitable, and this mock intentionally mirrors that contract.
              then: (
                onFulfilled?: (value: { error: unknown }) => unknown,
                onRejected?: (reason: unknown) => unknown
              ) =>
                Promise.resolve(dedupDeleteResult).then(
                  onFulfilled,
                  onRejected
                ),
            };
            return chain;
          }),
          insert: vi.fn((row: unknown) => {
            mocks.dedupInsert(row);
            return Promise.resolve(dedupInsertResult);
          }),
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => {
              mocks.dedupSelect(column, value);
              return {
                maybeSingle: vi.fn().mockResolvedValue(dedupSelectResult),
              };
            }),
          })),
          update: vi.fn((row: unknown) => {
            const chain = {
              eq: vi.fn((column: string, value: string) => {
                mocks.dedupUpdate(row, column, value);
                return chain;
              }),
              match: vi.fn((criteria: Record<string, unknown>) => {
                mocks.dedupUpdate(row, 'match', criteria);
                return {
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue(dedupUpdateResult),
                  })),
                };
              }),
              // biome-ignore lint/suspicious/noThenProperty: Supabase update builders are awaitable, and this mock intentionally mirrors that contract.
              then: (
                onFulfilled?: (value: { error: unknown }) => unknown,
                onRejected?: (reason: unknown) => unknown
              ) =>
                Promise.resolve({ error: dedupUpdateResult.error }).then(
                  onFulfilled,
                  onRejected
                ),
            };
            return chain;
          }),
        };
      }
      if (table !== 'order_insurance_policies') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn((columns: string) => ({
          eq: vi.fn((column: string, value: string) => {
            mocks.policySelect(columns, column, value);
            return {
              maybeSingle: vi.fn().mockResolvedValue(policySelectResult),
            };
          }),
        })),
        update: vi.fn((payload: unknown) => {
          mocks.policyUpdate(payload);
          const chain = {
            eq: vi.fn((column: string, value: string) => {
              mocks.policyEq(column, value);
              return chain;
            }),
            error: policyUpdateResult.error,
            maybeSingle: vi.fn().mockResolvedValue(policyUpdateResult),
            select: vi.fn(() => chain),
          };

          return {
            ...chain,
          };
        }),
      };
    }),
  };
}

describe('POST /api/webhooks/mycover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MYCOVER_SECRET_KEY = 'mycover-api-secret';
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.getMyCoverWebhookSecret.mockReturnValue('MCASECK|secret');
    mocks.maybeNotifyActivateProtection.mockResolvedValue(undefined);
    mocks.createServiceClient.mockReturnValue(createSupabaseMock());
  });

  it('rejects invalid MyCover signatures before database writes', async () => {
    const response = await POST(
      createRequest(
        {
          data: { id: 'policy-123' },
          event: 'purchase.successful',
        },
        'bad-signature'
      )
    );

    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('rejects wrong-length MyCover signatures before database writes', async () => {
    const payload = {
      data: { id: 'policy-123' },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);
    const truncatedSignature = signPayload(rawBody, 'MCASECK|secret').slice(
      0,
      -2
    );

    const response = await POST(createRequest(payload, truncatedSignature));

    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('handles documented purchase.successful payloads with data.id purchase ids', async () => {
    const payload = {
      data: {
        amount: 5000,
        id: 'policy-123',
        policy_expiry_date: '2026-06-20T09:47:22.008Z',
        reference: 'BUY-PSKUEVZSSXVJRPQX',
        status: 'successful',
      },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        policy_expiry_date: '2026-06-20T09:47:22.008Z',
        status: 'active',
      })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_purchase_id',
      'policy-123'
    );
  });

  it('persists hosted claim_link and inspection_link from data.sdk', async () => {
    const payload = {
      data: {
        id: 'policy-123',
        status: 'successful',
        sdk: {
          claim_link: 'https://mycover.ai/purchase?q=claim-token',
          inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
        },
      },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activation_reminder_sent_at: null,
        claim_link: 'https://mycover.ai/purchase?q=claim-token',
        inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
        inspection_status: 'pending',
      })
    );
  });

  it('does not downgrade a completed inspection when a purchase webhook replays the same inspection link', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policySelectResult: {
          data: {
            inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
            inspection_status: 'completed',
          },
          error: null,
        },
      })
    );
    const payload = {
      data: {
        id: 'policy-123',
        status: 'successful',
        sdk: {
          claim_link: 'https://mycover.ai/purchase?q=claim-token',
          inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
        },
      },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    const updatePayload = mocks.policyUpdate.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updatePayload).toMatchObject({
      claim_link: 'https://mycover.ai/purchase?q=claim-token',
      inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
    });
    expect(updatePayload).not.toHaveProperty('inspection_status');
    expect(updatePayload).not.toHaveProperty('activation_reminder_sent_at');
  });

  it('drops non-HTTPS and non-MyCover hosted links before persisting', async () => {
    const payload = {
      data: {
        id: 'policy-123',
        sdk: {
          claim_link: 'https://evil.test/purchase?q=claim-token',
          inspection_link: 'http://mycover.ai/purchase?q=inspection-token',
        },
      },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    const updatePayload = mocks.policyUpdate.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updatePayload).not.toHaveProperty('claim_link');
    expect(updatePayload).not.toHaveProperty('inspection_link');
  });

  it('rechecks delivered-order activation when an inspection link is stored on purchase', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policyUpdateResult: {
          data: { id: 'policy-row', order_id: 'order-123' },
          error: null,
        },
      })
    );
    const payload = {
      data: {
        id: 'policy-123',
        status: 'successful',
        sdk: {
          inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
        },
      },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.maybeNotifyActivateProtection).toHaveBeenCalledWith(
      'order-123'
    );
  });

  it('omits claim/inspection links when data.sdk is absent', async () => {
    const payload = {
      data: { id: 'policy-123', status: 'successful' },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    const updatePayload = mocks.policyUpdate.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updatePayload).not.toHaveProperty('claim_link');
    expect(updatePayload).not.toHaveProperty('inspection_link');
  });

  it('persists the hosted claim link when preloss inspection.completed includes one', async () => {
    const payload = {
      data: {
        essential: {
          type: 'Gadget',
          status: 'completed',
          is_approved: true,
          category: 'preloss',
          policy_id: 'pol-abc',
        },
        meta: { policy_id: 'pol-abc' },
        sdk: {
          claim_link: 'https://mycover.ai/purchase?q=claim-after-inspect',
        },
      },
      event: 'inspection.completed',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        claim_link: 'https://mycover.ai/purchase?q=claim-after-inspect',
        inspection_status: 'completed',
      })
    );
  });

  it('marks the policy inspected on preloss inspection.completed', async () => {
    const payload = {
      data: {
        essential: {
          type: 'Gadget',
          status: 'completed',
          is_approved: true,
          category: 'preloss',
          policy_id: 'pol-abc',
        },
        meta: { policy_id: 'pol-abc' },
      },
      event: 'inspection.completed',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ inspection_status: 'completed' })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith('mycover_policy_id', 'pol-abc');
  });

  it('reads preloss inspection category from data.meta', async () => {
    const payload = {
      data: {
        essential: {
          status: 'completed',
          is_approved: true,
        },
        meta: {
          category: 'preloss',
          policy_id: 'pol-meta',
        },
      },
      event: 'inspection.completed',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ inspection_status: 'completed' })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_policy_id',
      'pol-meta'
    );
  });

  it('does not activate coverage for unapproved preloss inspection.completed events', async () => {
    const payload = {
      data: {
        essential: {
          type: 'Gadget',
          status: 'completed',
          is_approved: false,
          category: 'preloss',
          policy_id: 'pol-abc',
        },
        meta: { policy_id: 'pol-abc' },
        sdk: {
          claim_link: 'https://mycover.ai/purchase?q=claim-after-reject',
        },
      },
      event: 'inspection.completed',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).not.toHaveBeenCalled();
  });

  it('ignores non-preloss inspection.completed events', async () => {
    const payload = {
      data: {
        essential: {
          status: 'completed',
          category: 'postloss',
          policy_id: 'pol-abc',
        },
      },
      event: 'inspection.completed',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).not.toHaveBeenCalled();
  });

  it('fails purchase webhooks when no stored policy row is updated', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policyUpdateResult: { data: null, error: null },
      })
    );
    const payload = {
      data: {
        amount: 5000,
        id: 'purchase-123',
        policy_expiry_date: '2026-06-20T09:47:22.008Z',
        reference: 'BUY-PSKUEVZSSXVJRPQX',
        status: 'successful',
      },
      event: 'purchase.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Webhook processing failed' });
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_purchase_id',
      'purchase-123'
    );
  });

  it('does not use claim data.id as a stored policy identifier', async () => {
    const payload = {
      data: {
        claim_id: 'claim-123',
        id: 'claim-123',
        status: 'approved',
      },
      event: 'claim.approved',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).not.toHaveBeenCalled();
    expect(mocks.policyEq).not.toHaveBeenCalled();
  });

  it('fails policy.expired webhooks when the stored policy update errors', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policyUpdateResult: {
          data: null,
          error: { message: 'policy expiry failed' },
        },
      })
    );
    const payload = {
      data: {
        policy_id: 'policy-123',
        status: 'expired',
      },
      event: 'policy.expired',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Webhook processing failed' });
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_policy_id',
      'policy-123'
    );
  });

  it('fails claim webhooks when the stored policy update errors', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policyUpdateResult: {
          data: null,
          error: { message: 'claim update failed' },
        },
      })
    );
    const payload = {
      data: {
        claim_id: 'claim-123',
        policy_id: 'policy-123',
        status: 'approved',
      },
      event: 'claim.approved',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Webhook processing failed' });
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_policy_id',
      'policy-123'
    );
  });

  it('handles documented renewal.successful payloads', async () => {
    const payload = {
      data: {
        amount: 5000,
        id: 'renewal-123',
        policy_expiry_date: '2027-06-20T09:47:22.008Z',
        purchase_id: 'policy-123',
        reference: 'BUY-PSKUEVZSSXVJRPQX',
        status: 'successful',
      },
      event: 'renewal.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        policy_expiry_date: '2027-06-20T09:47:22.008Z',
        status: 'active',
      })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_purchase_id',
      'policy-123'
    );
  });

  it('resolves purchase.renewed payloads that only include a purchase id', async () => {
    mocks.fetch.mockResolvedValue({
      json: async () => ({
        data: {
          policy: {
            id: 'policy-123',
          },
        },
      }),
      ok: true,
    });
    const payload = {
      data: {
        id: 'renewal-purchase-123',
        essential: {
          expiration_date: '2028-05-21T00:00:00.000Z',
        },
        sdk: {
          claim_link: 'https://mycover.ai/purchase?q=renewed-claim',
        },
      },
      event: 'purchase.renewed',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://v2.api.mycover.ai/v2/purchases/renewal-purchase-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mycover-api-secret',
        }),
      })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_policy_id',
      'policy-123'
    );
  });

  it('persists renewed hosted claim and inspection links', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policyUpdateResult: {
          data: { id: 'policy-row', order_id: 'order-123' },
          error: null,
        },
      })
    );
    const payload = {
      data: {
        essential: {
          policy_id: 'policy-123',
          expiration_date: '2028-05-21T00:00:00.000Z',
        },
        sdk: {
          claim_link: 'https://mycover.ai/purchase?q=renewed-claim',
          inspection_link: 'https://mycover.ai/purchase?q=renewed-inspect',
        },
      },
      event: 'purchase.renewed',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.policyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        claim_link: 'https://mycover.ai/purchase?q=renewed-claim',
        activation_reminder_sent_at: null,
        inspection_link: 'https://mycover.ai/purchase?q=renewed-inspect',
        inspection_status: 'pending',
        policy_expiry_date: '2028-05-21T00:00:00.000Z',
        status: 'active',
      })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_policy_id',
      'policy-123'
    );
    expect(mocks.maybeNotifyActivateProtection).toHaveBeenCalledWith(
      'order-123'
    );
  });

  it('fails renewal webhooks when the stored policy update errors', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policyUpdateResult: {
          data: null,
          error: { message: 'policy update failed' },
        },
      })
    );
    const payload = {
      data: {
        amount: 5000,
        id: 'renewal-123',
        policy_expiry_date: '2027-06-20T09:47:22.008Z',
        purchase_id: 'policy-123',
        reference: 'BUY-PSKUEVZSSXVJRPQX',
        status: 'successful',
      },
      event: 'renewal.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Webhook processing failed' });
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_purchase_id',
      'policy-123'
    );
  });

  it('resolves renewal.successful payloads that only include a renewal id', async () => {
    mocks.fetch.mockResolvedValue({
      json: async () => ({
        data: {
          policy: {
            id: 'policy-123',
          },
        },
      }),
      ok: true,
    });
    const payload = {
      data: {
        id: 'renewal-123',
        policy_expiry_date: '2027-06-20T09:47:22.008Z',
        reference: 'BUY-PSKUEVZSSXVJRPQX',
        status: 'successful',
      },
      event: 'renewal.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://v2.api.mycover.ai/v2/purchases/renewal-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mycover-api-secret',
        }),
      })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_policy_id',
      'policy-123'
    );
  });

  it('uses the configured webhook secret for renewal lookups when no API secret is set', async () => {
    delete process.env.MYCOVER_SECRET_KEY;
    mocks.getMyCoverWebhookSecret.mockReturnValue('webhook-only-secret');
    mocks.fetch.mockResolvedValue({
      json: async () => ({
        data: {
          id: 'purchase-123',
        },
      }),
      ok: true,
    });
    const payload = {
      data: {
        id: 'renewal-123',
        policy_expiry_date: '2027-06-20T09:47:22.008Z',
        reference: 'BUY-PSKUEVZSSXVJRPQX',
        status: 'successful',
      },
      event: 'renewal.successful',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'webhook-only-secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://v2.api.mycover.ai/v2/purchases/renewal-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer webhook-only-secret',
        }),
      })
    );
    expect(mocks.policyEq).toHaveBeenCalledWith(
      'mycover_purchase_id',
      'purchase-123'
    );
  });

  describe('documented envelope (data.essential / data.meta)', () => {
    it('reads purchase fields from data.essential', async () => {
      const payload = {
        event: 'purchase.successful',
        data: {
          essential: {
            policy_id: 'pol-essential',
            policy_number: 'OG/AR/2026/1',
            start_date: '2026-05-21T00:00:00.000Z',
            expiration_date: '2027-05-21T00:00:00.000Z',
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          mycover_policy_number: 'OG/AR/2026/1',
          policy_start_date: '2026-05-21T00:00:00.000Z',
          policy_expiry_date: '2027-05-21T00:00:00.000Z',
          status: 'active',
        })
      );
      expect(mocks.policyEq).toHaveBeenCalledWith(
        'mycover_policy_id',
        'pol-essential'
      );
    });

    it('records a settlement offer from claim.offer_sent with progress', async () => {
      const payload = {
        event: 'claim.offer_sent',
        data: {
          essential: { policy_id: 'pol-1', status: 'Offer sent' },
          meta: { policy_id: 'pol-1', progress: 'offer' },
          sdk: {
            claim_link: 'https://mycover.ai/purchase?q=continue-claim',
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'offer_sent',
          claim_stage: 'Offer sent',
          claim_link: 'https://mycover.ai/purchase?q=continue-claim',
          claim_progress: 'offer',
        })
      );
      expect(mocks.policyEq).toHaveBeenCalledWith('mycover_policy_id', 'pol-1');
    });

    it('records accepted and paid claim lifecycle events', async () => {
      const acceptedPayload = {
        event: 'claim.offer_accepted',
        data: {
          essential: { policy_id: 'pol-1', status: 'Offer accepted' },
          meta: { policy_id: 'pol-1', progress: 'accepted' },
        },
      };
      const acceptedRawBody = JSON.stringify(acceptedPayload);

      let response = await POST(
        createRequest(
          acceptedPayload,
          signPayload(acceptedRawBody, 'MCASECK|secret')
        )
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'offer_accepted',
          claim_progress: 'accepted',
        })
      );

      vi.clearAllMocks();
      mocks.getMyCoverWebhookSecret.mockReturnValue('MCASECK|secret');
      mocks.createServiceClient.mockReturnValue(createSupabaseMock());

      const paidPayload = {
        event: 'claim.paid',
        data: {
          essential: { policy_id: 'pol-1', status: 'Paid' },
          meta: { policy_id: 'pol-1', progress: 'paid' },
        },
      };
      const paidRawBody = JSON.stringify(paidPayload);

      response = await POST(
        createRequest(paidPayload, signPayload(paidRawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'paid',
          claim_progress: 'paid',
          status: 'claimed',
        })
      );
    });

    it.each([
      'claim.disapproved',
      'claim.offer_rejected',
      'claim.rejected',
    ])('captures the decline reason from %s', async (event) => {
      const payload = {
        event,
        data: {
          essential: {
            policy_id: 'pol-1',
            status: 'Declined',
            comment: 'Out of coverage window',
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'declined',
          claim_comment: 'Out of coverage window',
        })
      );
    });

    it('reads legacy claim.updated status fields without wiping omitted details', async () => {
      const payload = {
        event: 'claim.updated',
        data: {
          policy_id: 'pol-1',
          status: 'Approved',
        },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      const updatePayload = mocks.policyUpdate.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(updatePayload).toEqual(
        expect.objectContaining({
          claim_status: 'approved',
          claim_stage: 'Approved',
        })
      );
      expect(updatePayload).not.toHaveProperty('claim_progress');
      expect(updatePayload).not.toHaveProperty('claim_comment');
    });

    it('falls back to legacy data.claim_status on generic claim updates', async () => {
      const payload = {
        event: 'claim.updated',
        data: {
          policy_id: 'pol-1',
          claim_status: 'Offer sent',
        },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'offer_sent',
          claim_stage: 'Offer sent',
        })
      );
    });

    it('refreshes certificate_url on policy.updated', async () => {
      const payload = {
        event: 'policy.updated',
        data: {
          essential: {
            policy_id: 'pol-1',
            certificate_url: 'https://s3.example.com/cert.pdf',
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          certificate_url: 'https://s3.example.com/cert.pdf',
        })
      );
    });

    it('refreshes hosted links on policy.updated and rechecks delivered-order activation', async () => {
      mocks.createServiceClient.mockReturnValue(
        createSupabaseMock({
          policyUpdateResult: {
            data: { id: 'policy-row', order_id: 'order-123' },
            error: null,
          },
        })
      );
      const payload = {
        event: 'policy.updated',
        data: {
          essential: { policy_id: 'pol-1' },
          sdk: {
            claim_link: 'https://mycover.ai/purchase?q=claim-new',
            inspection_link: 'https://mycover.ai/purchase?q=inspect-new',
          },
        },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          activation_reminder_sent_at: null,
          claim_link: 'https://mycover.ai/purchase?q=claim-new',
          inspection_link: 'https://mycover.ai/purchase?q=inspect-new',
          inspection_status: 'pending',
        })
      );
      expect(mocks.maybeNotifyActivateProtection).toHaveBeenCalledWith(
        'order-123'
      );
    });
  });

  it('preserves completed inspection state when policy.updated replays the same inspection link', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        policySelectResult: {
          data: {
            inspection_link: 'https://mycover.ai/purchase?q=inspect-new',
            inspection_status: 'completed',
          },
          error: null,
        },
        policyUpdateResult: {
          data: { id: 'policy-row', order_id: 'order-123' },
          error: null,
        },
      })
    );
    const payload = {
      event: 'policy.updated',
      data: {
        essential: { policy_id: 'pol-1' },
        sdk: {
          claim_link: 'https://mycover.ai/purchase?q=claim-new',
          inspection_link: 'https://mycover.ai/purchase?q=inspect-new',
        },
      },
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );

    expect(response.status).toBe(200);
    const updatePayload = mocks.policyUpdate.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(updatePayload).toMatchObject({
      claim_link: 'https://mycover.ai/purchase?q=claim-new',
      inspection_link: 'https://mycover.ai/purchase?q=inspect-new',
    });
    expect(updatePayload).not.toHaveProperty('inspection_status');
    expect(updatePayload).not.toHaveProperty('activation_reminder_sent_at');
  });

  describe('idempotency', () => {
    it('skips processing when the event_id was already processed', async () => {
      mocks.createServiceClient.mockReturnValue(
        createSupabaseMock({
          dedupInsertResult: {
            error: { code: '23505', message: 'duplicate key' },
          },
          dedupSelectResult: {
            data: { processing_status: 'processed' },
            error: null,
          },
        })
      );
      const payload = {
        event_id: 'evt-1',
        event: 'purchase.successful',
        data: { essential: { policy_id: 'pol-1' } },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ received: true, duplicate: true });
      expect(mocks.dedupInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: 'evt-1' })
      );
      expect(mocks.dedupSelect).toHaveBeenCalledWith('event_id', 'evt-1');
      expect(mocks.policyUpdate).not.toHaveBeenCalled();
      expect(mocks.dedupDelete).not.toHaveBeenCalled();
    });

    it('returns a retryable non-2xx response when the event_id is still processing', async () => {
      mocks.createServiceClient.mockReturnValue(
        createSupabaseMock({
          dedupInsertResult: {
            error: { code: '23505', message: 'duplicate key' },
          },
          dedupSelectResult: {
            data: { processing_status: 'processing' },
            error: null,
          },
        })
      );
      const payload = {
        event_id: 'evt-processing',
        event: 'purchase.successful',
        data: { essential: { policy_id: 'pol-1' } },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toEqual({
        error: 'Webhook event is still processing',
        retry: true,
      });
      expect(mocks.policyUpdate).not.toHaveBeenCalled();
      expect(mocks.dedupDelete).not.toHaveBeenCalled();
    });

    it('claims the event_id before successful processing and marks it processed after', async () => {
      const payload = {
        event_id: 'evt-2',
        event: 'purchase.successful',
        data: { essential: { policy_id: 'pol-1' } },
      };
      const rawBody = JSON.stringify(payload);

      await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(mocks.dedupInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: 'evt-2' })
      );
      expect(mocks.policyUpdate).toHaveBeenCalled();
      expect(mocks.dedupInsert.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.policyUpdate.mock.invocationCallOrder[0]
      );
      expect(mocks.policyUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.dedupUpdate.mock.invocationCallOrder[0]
      );
      expect(mocks.dedupUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ processing_status: 'processed' }),
        'event_id',
        'evt-2'
      );
      expect(mocks.dedupDelete).not.toHaveBeenCalled();
    });

    it('reclaims stale processing event_ids and completes them after retry processing', async () => {
      mocks.createServiceClient.mockReturnValue(
        createSupabaseMock({
          dedupInsertResult: {
            error: { code: '23505', message: 'duplicate key' },
          },
          dedupSelectResult: {
            data: {
              processing_status: 'processing',
              received_at: '2000-01-01T00:00:00.000Z',
            },
            error: null,
          },
          dedupUpdateResult: {
            data: { processing_status: 'processing' },
            error: null,
          },
        })
      );
      const payload = {
        event_id: 'evt-stale',
        event: 'claim.updated',
        data: { policy_id: 'pol-1', status: 'Offer sent' },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(200);
      expect(mocks.policyUpdate).toHaveBeenCalled();
      expect(mocks.dedupUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          event: 'claim.updated',
          processed_at: null,
          processing_status: 'processing',
        }),
        'match',
        {
          event_id: 'evt-stale',
          processing_status: 'processing',
          received_at: '2000-01-01T00:00:00.000Z',
        }
      );
      expect(mocks.dedupUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ processing_status: 'processed' }),
        'event_id',
        'evt-stale'
      );
      expect(mocks.dedupUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ processing_status: 'processed' }),
        'received_at',
        expect.any(String)
      );
    });

    it('does not process when a stale event_id is completed before reclaim', async () => {
      mocks.createServiceClient.mockReturnValue(
        createSupabaseMock({
          dedupInsertResult: {
            error: { code: '23505', message: 'duplicate key' },
          },
          dedupSelectResult: {
            data: {
              processing_status: 'processing',
              received_at: '2000-01-01T00:00:00.000Z',
            },
            error: null,
          },
          dedupUpdateResult: { data: null, error: null },
        })
      );
      const payload = {
        event_id: 'evt-raced',
        event: 'claim.updated',
        data: { policy_id: 'pol-1', status: 'Offer sent' },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(409);
      expect(mocks.policyUpdate).not.toHaveBeenCalled();
    });

    it('releases the claimed event_id when processing fails so retries stay open', async () => {
      mocks.createServiceClient.mockReturnValue(
        createSupabaseMock({
          policyUpdateResult: { data: null, error: { message: 'boom' } },
        })
      );
      const payload = {
        event_id: 'evt-3',
        event: 'purchase.successful',
        data: { essential: { policy_id: 'pol-1' } },
      };
      const rawBody = JSON.stringify(payload);

      const response = await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(response.status).toBe(500);
      expect(mocks.dedupInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: 'evt-3' })
      );
      expect(mocks.dedupDelete).toHaveBeenCalledWith('event_id', 'evt-3');
    });
  });

  it('acknowledges but skips processing failed-status events', async () => {
    const payload = {
      event: 'purchase.successful',
      status: 'failed',
      data: { essential: { policy_id: 'pol-1' } },
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, skipped: 'failed_status' });
    expect(mocks.policyUpdate).not.toHaveBeenCalled();
  });

  it('fail-closes on a non-lowercase failed status (e.g. "FAILED")', async () => {
    const payload = {
      event: 'purchase.successful',
      status: '  FAILED  ',
      data: { essential: { policy_id: 'pol-1' } },
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, skipped: 'failed_status' });
    expect(mocks.policyUpdate).not.toHaveBeenCalled();
  });

  it('accepts a signature computed over the re-serialized JSON body', async () => {
    // Body with whitespace; MyCover signs JSON.stringify(parsed) (no spaces).
    const canonical = JSON.stringify({
      event: 'purchase.successful',
      data: { essential: { policy_id: 'pol-1' } },
    });
    const rawBody = `${canonical.slice(0, -1)} \n}`; // same JSON, extra spacing
    const signature = signPayload(canonical, 'MCASECK|secret');

    const request = new NextRequest(
      'https://usebaci.com/api/webhooks/mycover',
      {
        body: rawBody,
        headers: {
          'Content-Type': 'application/json',
          'x-mycoverai-signature': signature,
        },
        method: 'POST',
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});
