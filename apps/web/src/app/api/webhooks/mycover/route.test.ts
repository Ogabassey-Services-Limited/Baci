import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getMyCoverWebhookSecret: vi.fn(),
  policyEq: vi.fn(),
  policyUpdate: vi.fn(),
}));

vi.mock('@/env', () => ({
  getMyCoverWebhookSecret: () => mocks.getMyCoverWebhookSecret(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mocks.createServiceClient(),
}));

import { POST } from './route';

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

function createSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'order_insurance_policies') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        update: vi.fn((payload: unknown) => {
          mocks.policyUpdate(payload);
          return {
            eq: mocks.policyEq.mockResolvedValue({ error: null }),
          };
        }),
      };
    }),
  };
}

describe('POST /api/webhooks/mycover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMyCoverWebhookSecret.mockReturnValue('MCASECK|secret');
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

  it('handles documented renewal.successful payloads', async () => {
    const payload = {
      data: {
        amount: 5000,
        id: 'policy-123',
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
});
