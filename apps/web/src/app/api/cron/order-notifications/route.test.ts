import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: () => 'secret',
}));

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSupabase,
}));

const mockSendOrderFulfillmentNotification = vi.hoisted(() => vi.fn());

vi.mock('@/lib/order-fulfillment-notification', () => ({
  sendOrderFulfillmentNotification: mockSendOrderFulfillmentNotification,
}));

import { sendOrderFulfillmentNotification } from '@/lib/order-fulfillment-notification';
import { GET, maxDuration } from './route';

function cronRequest(path = '/api/cron/order-notifications') {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { Authorization: 'Bearer secret' },
    method: 'GET',
  });
}

function createUpdateBuilder() {
  const builder = {
    eq: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn(() => builder),
  };
  return builder;
}

describe('GET /api/cron/order-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          attempt_count: 1,
          event_type: 'order_shipped',
          id: 'outbox-1',
          max_attempts: 5,
          merchant_id: 'merchant-1',
          order_id: 'order-1',
        },
        {
          attempt_count: 1,
          event_type: 'order_delivered',
          id: 'outbox-2',
          max_attempts: 5,
          merchant_id: 'merchant-1',
          order_id: 'order-2',
        },
      ],
      error: null,
    });
    mockSupabase.from.mockReturnValue(createUpdateBuilder());
    mockSendOrderFulfillmentNotification
      .mockResolvedValueOnce({ status: 'sent', messageId: 'msg-1' })
      .mockResolvedValueOnce({
        status: 'skipped',
        reason: 'missing_customer_email',
      });
  });

  it('exposes a bounded duration for VPS cron execution', () => {
    expect(maxDuration).toBe(60);
  });

  it('rejects missing cron bearer tokens fail-closed', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/cron/order-notifications')
    );

    expect(response.status).toBe(401);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 500 when claiming outbox rows fails', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc down' },
    });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to claim order notifications' });
    expect(sendOrderFulfillmentNotification).not.toHaveBeenCalled();
  });

  it('claims due notifications and marks sent/skipped outcomes without blocking fulfillment', async () => {
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'claim_order_notification_outbox',
      expect.objectContaining({ p_batch_size: 25 })
    );
    expect(sendOrderFulfillmentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'order_shipped',
        merchantId: 'merchant-1',
        orderId: 'order-1',
      })
    );
    expect(body).toMatchObject({
      claimed: 2,
      failed: 0,
      retried: 0,
      sent: 1,
      skipped: 1,
      success: true,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('order_notification_outbox');
  });

  it('reschedules retryable failures instead of failing the cron batch', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          attempt_count: 2,
          event_type: 'order_delivered',
          id: 'outbox-3',
          max_attempts: 5,
          merchant_id: 'merchant-1',
          order_id: 'order-3',
        },
      ],
      error: null,
    });
    mockSendOrderFulfillmentNotification.mockReset();
    mockSendOrderFulfillmentNotification.mockResolvedValueOnce({
      status: 'failed',
      error: 'provider down',
    });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ failed: 0, retried: 1, success: true });
    const updateBuilder = mockSupabase.from.mock.results[0]?.value;
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_error: 'provider down',
        status: 'pending',
      })
    );
  });

  it('marks exhausted failed notifications as terminal failed', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          attempt_count: 5,
          event_type: 'order_delivered',
          id: 'outbox-4',
          max_attempts: 5,
          merchant_id: 'merchant-1',
          order_id: 'order-4',
        },
      ],
      error: null,
    });
    mockSendOrderFulfillmentNotification.mockReset();
    mockSendOrderFulfillmentNotification.mockResolvedValueOnce({
      status: 'failed',
      error: 'provider down',
    });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ failed: 1, retried: 0, success: true });
    const updateBuilder = mockSupabase.from.mock.results[0]?.value;
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_error: 'provider down',
        next_attempt_at: null,
        status: 'failed',
      })
    );
  });
});
