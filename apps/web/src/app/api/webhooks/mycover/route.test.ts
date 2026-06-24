import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  dedupInsert: vi.fn(),
  fetch: vi.fn(),
  getMyCoverWebhookSecret: vi.fn(),
  maybeNotifyActivateProtection: vi.fn(),
  policyEq: vi.fn(),
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
  dedupInsertResult = { error: null } as { error: unknown },
  dedupExisting = null as { event_id: string } | null,
}: {
  policyUpdateResult?: { data: unknown; error: unknown };
  dedupInsertResult?: { error: unknown };
  dedupExisting?: { event_id: string } | null;
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'mycover_webhook_events') {
        return {
          // Dedup existence check: select(...).eq(...).maybeSingle()
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: dedupExisting, error: null }),
            })),
          })),
          insert: vi.fn((row: unknown) => {
            mocks.dedupInsert(row);
            return Promise.resolve(dedupInsertResult);
          }),
        };
      }
      if (table !== 'order_insurance_policies') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
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
        claim_link: 'https://mycover.ai/purchase?q=claim-token',
        inspection_link: 'https://mycover.ai/purchase?q=inspection-token',
      })
    );
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

  it('marks the policy inspected on preloss inspection.completed', async () => {
    const payload = {
      data: {
        essential: {
          type: 'Gadget',
          status: 'completed',
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
        inspection_link: 'https://mycover.ai/purchase?q=renewed-inspect',
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
      'https://api.mycover.ai/v1/renewals/renewal-123',
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
          purchase: {
            id: 'purchase-123',
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
      createRequest(payload, signPayload(rawBody, 'webhook-only-secret'))
    );

    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://api.mycover.ai/v1/renewals/renewal-123',
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

    it('captures the decline reason from claim.disapproved', async () => {
      const payload = {
        event: 'claim.disapproved',
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
          claim_link: 'https://mycover.ai/purchase?q=claim-new',
          inspection_link: 'https://mycover.ai/purchase?q=inspect-new',
        })
      );
      expect(mocks.maybeNotifyActivateProtection).toHaveBeenCalledWith(
        'order-123'
      );
    });
  });

  describe('idempotency', () => {
    it('skips processing when the event_id was already recorded', async () => {
      mocks.createServiceClient.mockReturnValue(
        createSupabaseMock({ dedupExisting: { event_id: 'evt-1' } })
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
      expect(mocks.policyUpdate).not.toHaveBeenCalled();
      expect(mocks.dedupInsert).not.toHaveBeenCalled();
    });

    it('records the event_id only after successful processing', async () => {
      const payload = {
        event_id: 'evt-2',
        event: 'purchase.successful',
        data: { essential: { policy_id: 'pol-1' } },
      };
      const rawBody = JSON.stringify(payload);

      await POST(
        createRequest(payload, signPayload(rawBody, 'MCASECK|secret'))
      );

      expect(mocks.policyUpdate).toHaveBeenCalled();
      expect(mocks.dedupInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_id: 'evt-2' })
      );
    });

    it('does NOT record the event_id when processing fails (retry stays open)', async () => {
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
      expect(mocks.dedupInsert).not.toHaveBeenCalled();
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
