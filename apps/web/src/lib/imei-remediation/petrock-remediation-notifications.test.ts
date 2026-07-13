import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifyCustomer: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/env', () => ({ getRootDomain: () => 'usebaci.com' }));
vi.mock('@/lib/expo-push', () => ({ notifyCustomer: mocks.notifyCustomer }));
vi.mock('@/lib/zeptomail', () => ({ sendEmail: mocks.sendEmail }));

import { notifyPetrockRemediationTerminal } from './petrock-remediation-notifications';

function builder(data: Record<string, unknown> | null) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    select: vi.fn(() => query),
  };
  return query;
}

function admin({ claim = true }: { claim?: boolean } = {}) {
  const order = builder({
    amount_ngn: null,
    amount_usdt: 65,
    carrier: 'AT&T',
    customer_id: 'customer-1',
    customer_message: 'Complete',
    id: 'order-1',
    merchant_id: 'merchant-1',
    payment_currency: 'USDT',
    status: 'completed',
  });
  const customer = builder({
    email: 'ada@example.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
    user_id: 'user-1',
  });
  const merchant = builder({
    business_name: 'Ogabassey',
    slug: 'ogabassey',
  });
  const rpc = vi.fn((name: string) =>
    Promise.resolve({
      data: name === 'claim_petrock_remediation_notification' ? claim : true,
      error: null,
    })
  );
  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === 'petrock_orders') return order;
        if (table === 'customers') return customer;
        return merchant;
      }),
      rpc,
    },
    rpc,
  };
}

describe('notifyPetrockRemediationTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({ messageId: 'mail-1', success: true });
    mocks.notifyCustomer.mockResolvedValue({ errors: [], failed: 0, sent: 1 });
  });

  it('claims and sends email plus storefront push with unlock-order context', async () => {
    const supabase = admin();

    await expect(
      notifyPetrockRemediationTerminal({
        orderId: 'order-1',
        supabaseAdmin: supabase.client as never,
      })
    ).resolves.toEqual({ email: 'sent', push: 'sent' });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        textContent: expect.stringContaining('/unlock-orders'),
      })
    );
    expect(mocks.notifyCustomer).toHaveBeenCalledWith(
      'user-1',
      'Carrier unlock complete',
      expect.stringContaining('AT&T'),
      expect.objectContaining({ orderId: 'order-1', type: 'carrier_unlock' }),
      'orders'
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_petrock_remediation_notification',
      expect.objectContaining({
        p_channel: 'email',
        p_claim_token: expect.any(String),
        p_order_id: 'order-1',
      })
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_petrock_remediation_notification',
      expect.objectContaining({
        p_channel: 'push',
        p_claim_token: expect.any(String),
        p_order_id: 'order-1',
      })
    );
  });

  it('does not send a duplicate when another worker already claimed channels', async () => {
    const supabase = admin({ claim: false });

    await expect(
      notifyPetrockRemediationTerminal({
        orderId: 'order-1',
        supabaseAdmin: supabase.client as never,
      })
    ).resolves.toEqual({ email: 'skipped', push: 'skipped' });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.notifyCustomer).not.toHaveBeenCalled();
  });

  it('clears a failed channel claim so a later cron can retry', async () => {
    const supabase = admin();
    mocks.sendEmail.mockResolvedValue({ error: 'down', success: false });

    await notifyPetrockRemediationTerminal({
      orderId: 'order-1',
      supabaseAdmin: supabase.client as never,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'clear_petrock_remediation_notification',
      expect.objectContaining({
        p_channel: 'email',
        p_claim_token: expect.any(String),
        p_order_id: 'order-1',
      })
    );
  });
});
