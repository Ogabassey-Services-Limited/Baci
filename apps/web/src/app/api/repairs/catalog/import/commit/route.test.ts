import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authorizeRepairsRequest,
  createImportCommitRepository,
  commitImportRows,
} = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  createImportCommitRepository: vi.fn(),
  commitImportRows: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest,
}));
vi.mock('@/lib/repairs/import-commit-repository', () => ({
  createImportCommitRepository,
}));
vi.mock('@/lib/repairs/import-commit', () => ({ commitImportRows }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { POST } from './route';

function okAuthz() {
  return { ok: true, access: { merchantId: 'm-1' }, supabase: {} };
}

const validRow = {
  brand: 'Apple',
  model: 'iPhone 12',
  repairType: 'Screen Replacement',
  price: 25000,
};

function req(body?: unknown) {
  return new Request('https://s.example/api/repairs/catalog/import/commit', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createImportCommitRepository.mockReturnValue({});
});

describe('POST /api/repairs/catalog/import/commit', () => {
  it('returns 401 when unauthorized', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await POST(req({ rows: [validRow] }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 for an empty batch', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    const res = await POST(req({ rows: [] }) as never);
    expect(res.status).toBe(400);
  });

  it('commits rows and returns counts', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    commitImportRows.mockResolvedValue({
      serviceTypesCreated: 1,
      devicesCreated: 1,
      quotesCreated: 1,
      quotesUpdated: 0,
    });
    const res = await POST(req({ rows: [validRow] }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.counts.quotesCreated).toBe(1);
    expect(commitImportRows).toHaveBeenCalledWith(
      [expect.objectContaining(validRow)],
      {}
    );
  });

  it('returns 500 when the commit fails', async () => {
    authorizeRepairsRequest.mockResolvedValue(okAuthz());
    commitImportRows.mockRejectedValue(new Error('db down'));
    const res = await POST(req({ rows: [validRow] }) as never);
    expect(res.status).toBe(500);
  });

  it('returns 403 without edit permission', async () => {
    authorizeRepairsRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await POST(req({ rows: [validRow] }) as never);
    expect(res.status).toBe(403);
  });
});
