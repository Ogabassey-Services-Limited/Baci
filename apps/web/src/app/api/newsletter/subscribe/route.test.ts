import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void Promise.resolve()
        .then(callback)
        .catch(() => undefined);
    },
  };
});

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

const mockSendEmail = vi.fn();

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockSyncZohoNewsletterSubscriber = vi.fn();

vi.mock('@/lib/zoho-newsletter-subscription', () => ({
  syncZohoNewsletterSubscriber: (...args: unknown[]) =>
    mockSyncZohoNewsletterSubscriber(...args),
}));

import { POST } from './route';

const merchantId = '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/newsletter/subscribe', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

async function flushAfterCallbacks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: 'subscribed', error: null });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: { business_name: 'Ogabassey' },
            error: null,
          }),
        }),
      }),
    });
    mockSendEmail.mockResolvedValue({ success: true });
    mockSyncZohoNewsletterSubscriber.mockResolvedValue({ status: 'synced' });
  });

  it('sends a ZeptoMail welcome email and syncs new subscribers to Zoho Campaigns', async () => {
    const res = await POST(
      makeRequest({
        email: 'Customer@Example.com',
        merchantId,
        source: 'footer',
      })
    );
    await flushAfterCallbacks();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('subscribe_newsletter', {
      p_email: 'customer@example.com',
      p_merchant_id: merchantId,
      p_source: 'footer',
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emailType: 'newsletter',
        fromName: 'Ogabassey',
        to: 'customer@example.com',
      })
    );
    expect(mockSyncZohoNewsletterSubscriber).toHaveBeenCalledWith({
      email: 'customer@example.com',
      merchantId,
      source: 'footer',
    });
  });

  it('syncs resubscribed contacts to Zoho without resending the welcome email', async () => {
    mockRpc.mockResolvedValue({ data: 'resubscribed', error: null });

    const res = await POST(
      makeRequest({
        email: 'customer@example.com',
        merchantId,
        source: 'popup',
      })
    );
    await flushAfterCallbacks();

    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSyncZohoNewsletterSubscriber).toHaveBeenCalledWith({
      email: 'customer@example.com',
      merchantId,
      source: 'popup',
    });
  });

  it('does not sync already-subscribed contacts again', async () => {
    mockRpc.mockResolvedValue({ data: 'already_subscribed', error: null });

    const res = await POST(
      makeRequest({
        email: 'customer@example.com',
        merchantId,
        source: 'widget',
      })
    );
    await flushAfterCallbacks();

    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSyncZohoNewsletterSubscriber).not.toHaveBeenCalled();
  });
});
