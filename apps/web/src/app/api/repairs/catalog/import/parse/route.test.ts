import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authorizeRepairsRequest,
  parseRepairPriceList,
  loadImportMatchContext,
} = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  parseRepairPriceList: vi.fn(),
  loadImportMatchContext: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest,
}));
vi.mock('@/lib/repairs/import-context', () => ({ loadImportMatchContext }));
vi.mock('@/lib/repairs/import-gemma', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/repairs/import-gemma')>();
  return { ...actual, parseRepairPriceList };
});

import { RepairsImportUnavailableError } from '@/lib/repairs/import-gemma';
import { POST } from './route';

function okAuthz() {
  return { ok: true, access: { merchantId: 'm-1' }, supabase: {} };
}

function req(body?: unknown) {
  return new Request('https://s.example/api/repairs/catalog/import/parse', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const emptyContext = { devices: [], products: [], serviceTypes: [] };

beforeEach(() => {
  vi.clearAllMocks();
  loadImportMatchContext.mockResolvedValue(emptyContext);
});

describe('POST /api/repairs/catalog/import/parse', () => {
  it('returns 401 when unauthorized', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await POST(req({ text: 'iPhone 12 screen 25000' }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty text', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await POST(req({ text: '  ' }) as never);
    expect(res.status).toBe(400);
  });

  it('returns draft rows on success', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    parseRepairPriceList.mockResolvedValue([
      {
        brand: 'Apple',
        model: 'iPhone 12',
        repairType: 'Screen Replacement',
        price: 25000,
        partQuality: null,
      },
    ]);
    const res = await POST(req({ text: 'iPhone 12 screen 25000' }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0].status).toBe('new_device');
  });

  it('returns 503 when Gemma is not configured', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    parseRepairPriceList.mockRejectedValue(new RepairsImportUnavailableError());
    const res = await POST(req({ text: 'iPhone 12 screen 25000' }) as never);
    expect(res.status).toBe(503);
  });

  it('returns 502 on a Gemma failure', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    parseRepairPriceList.mockRejectedValue(new Error('network'));
    const res = await POST(req({ text: 'iPhone 12 screen 25000' }) as never);
    expect(res.status).toBe(502);
  });

  it('returns 403 without edit permission', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await POST(req({ text: 'x' }) as never);
    expect(res.status).toBe(403);
  });
});
