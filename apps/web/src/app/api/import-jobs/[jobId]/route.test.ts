import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { noStoreMock } = vi.hoisted(() => ({
  noStoreMock: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_noStore: noStoreMock,
}));

vi.mock('@/lib/import-jobs/import-job-route-auth', () => ({
  getImportJobForMerchant: vi.fn(),
  hasImportRoutePermission: vi.fn(),
  resolveImportRouteContext: vi.fn(),
}));

import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  type ImportRouteContext,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import { GET } from './route';

const jobId = '00000000-0000-4000-8000-000000000001';

const baseCampaignStats = {
  claimedCount: 1,
  clickedCount: 1,
  lastActivityAt: '2026-06-27T10:05:00.000Z',
  loginStartedCount: 1,
  recipients: [
    {
      claimedAt: '2026-06-27T10:05:00.000Z',
      clickCount: 2,
      customerEmail: 'customer@example.com',
      customerName: 'Customer Example',
      firstClickedAt: '2026-06-27T10:00:00.000Z',
      firstLoginStartedAt: '2026-06-27T10:02:00.000Z',
      id: 'claim-1',
      lastClickedAt: '2026-06-27T10:01:00.000Z',
      lastLoginStartedAt: '2026-06-27T10:02:00.000Z',
      loginStartedCount: 1,
      notificationSentAt: '2026-06-27T09:59:00.000Z',
    },
  ],
  sentCount: 1,
  totalRecipients: 1,
};

function createSupabaseMock(
  campaignResponse: { data: unknown; error: unknown } = {
    data: baseCampaignStats,
    error: null,
  }
) {
  return {
    rpc: vi.fn().mockResolvedValue(campaignResponse),
  };
}

function createRouteContext(
  supabase = createSupabaseMock()
): ImportRouteContext {
  return {
    merchantContext: {
      merchantId: 'merchant-1',
    } as ImportRouteContext['merchantContext'],
    supabase: supabase as unknown as ImportRouteContext['supabase'],
    userId: 'user-1',
  };
}

describe('GET /api/import-jobs/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: createRouteContext(),
    });
    vi.mocked(hasImportRoutePermission).mockReturnValue(true);
  });

  it('disables caching via unstable_noStore', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue({
      id: jobId,
      entity_type: 'orders',
      status: 'preview_ready',
      summary: { validRows: 1 },
    } as never);

    const response = await GET(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}`),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    expect(noStoreMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
  });

  it('returns 401 when authentication fails', async () => {
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}`),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, no-cache, max-age=0, must-revalidate'
    );
  });

  it('returns 400 for an invalid job id', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/import-jobs/not-a-uuid'),
      { params: Promise.resolve({ jobId: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 when the import job does not exist', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue(null);

    const response = await GET(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}`),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(404);
  });

  it('returns 403 when the merchant lacks permission for the import entity', async () => {
    vi.mocked(getImportJobForMerchant).mockResolvedValue({
      id: jobId,
      entity_type: 'orders',
      status: 'preview_ready',
      summary: { validRows: 3 },
    } as never);
    vi.mocked(hasImportRoutePermission).mockReturnValue(false);

    const response = await GET(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}`),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(403);
  });

  it('returns job details with commit and notify capability flags', async () => {
    const supabase = createSupabaseMock();
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: createRouteContext(supabase),
    });
    vi.mocked(getImportJobForMerchant).mockResolvedValue({
      id: jobId,
      entity_type: 'orders',
      status: 'preview_ready',
      summary: { validRows: 3 },
    } as never);

    const response = await GET(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}`),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      job: expect.objectContaining({
        canCommit: true,
        canNotify: false,
        receiptCampaign: baseCampaignStats,
      }),
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_receipt_claim_campaign_stats',
      {
        p_import_job_id: jobId,
        p_merchant_id: 'merchant-1',
      }
    );
  });

  it('does not fail the job detail response when campaign stats cannot load', async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: { message: 'function missing' },
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: createRouteContext(supabase),
    });
    vi.mocked(getImportJobForMerchant).mockResolvedValue({
      id: jobId,
      entity_type: 'orders',
      status: 'completed',
      summary: { validRows: 3 },
    } as never);

    const response = await GET(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}`),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      job: expect.objectContaining({
        receiptCampaign: null,
      }),
    });
  });

  it('does not fail the job detail response when campaign stats are malformed', async () => {
    const supabase = createSupabaseMock({
      data: { claimedCount: 'not-a-number' },
      error: null,
    });
    vi.mocked(resolveImportRouteContext).mockResolvedValue({
      context: createRouteContext(supabase),
    });
    vi.mocked(getImportJobForMerchant).mockResolvedValue({
      id: jobId,
      entity_type: 'orders',
      status: 'completed',
      summary: { validRows: 3 },
    } as never);

    const response = await GET(
      new NextRequest(`http://localhost/api/import-jobs/${jobId}`),
      { params: Promise.resolve({ jobId }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      job: expect.objectContaining({
        receiptCampaign: null,
      }),
    });
  });
});
