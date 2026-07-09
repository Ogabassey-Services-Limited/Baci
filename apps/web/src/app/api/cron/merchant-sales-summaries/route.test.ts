import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getCronSecret: () => 'secret',
}));

const mockSummaryQuery = {
  gte: vi.fn(),
  lte: vi.fn(),
  select: vi.fn(),
};
const mockMerchantQuery = {
  in: vi.fn(),
  select: vi.fn(),
};
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

const mockSendEmail = vi.fn();

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { GET } from './route';

function makeRequest(path = '/api/cron/merchant-sales-summaries') {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { Authorization: 'Bearer secret' },
    method: 'GET',
  });
}

describe('GET /api/cron/merchant-sales-summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSummaryQuery.select.mockReturnValue(mockSummaryQuery);
    mockSummaryQuery.gte.mockReturnValue(mockSummaryQuery);
    mockSummaryQuery.lte.mockResolvedValue({
      data: [
        {
          avg_order_value: 10000,
          merchant_id: 'merchant-1',
          order_count: 2,
          paid_orders: 2,
          paid_revenue: 20000,
          pending_orders: 0,
          sale_date: '2026-06-07',
          total_revenue: 20000,
          unique_customers: 2,
        },
      ],
      error: null,
    });
    mockMerchantQuery.select.mockReturnValue(mockMerchantQuery);
    mockMerchantQuery.in.mockResolvedValue({
      data: [
        {
          business_name: 'Ogabassey',
          email: 'merchant@example.com',
          email_sender_name: null,
          id: 'merchant-1',
          payout_currency: 'NGN',
        },
      ],
      error: null,
    });
    mockFrom.mockImplementation((table: string) =>
      table === 'daily_sales_summary' ? mockSummaryQuery : mockMerchantQuery
    );
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('rejects requests without the cron secret', async () => {
    const res = await GET(
      new NextRequest('http://localhost:3000/api/cron/merchant-sales-summaries')
    );

    expect(res.status).toBe(401);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sends ZeptoMail summaries for merchants with sales rows', async () => {
    const res = await GET(
      makeRequest(
        '/api/cron/merchant-sales-summaries?period=daily&date=2026-06-07'
      )
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ failed: 0, sent: 1, success: true });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        clientReference:
          'merchant-sales-summary:daily:merchant-1:2026-06-07:2026-06-07',
        emailType: 'notifications',
        subject: 'Ogabassey daily sales summary',
        to: 'merchant@example.com',
      })
    );
  });

  it('formats the summary in the resolved merchant currency (not a hardcoded default)', async () => {
    mockMerchantQuery.in.mockResolvedValue({
      data: [
        {
          business_name: 'Accra Store',
          country: 'GH',
          email: 'merchant@example.com',
          email_sender_name: null,
          id: 'merchant-1',
          payout_currency: 'GHS',
        },
      ],
      error: null,
    });

    await GET(
      makeRequest(
        '/api/cron/merchant-sales-summaries?period=daily&date=2026-06-07'
      )
    );

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        textContent: expect.stringContaining('GHS'),
      })
    );
    expect(mockSendEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({
        textContent: expect.stringContaining('NGN'),
      })
    );
  });
});
