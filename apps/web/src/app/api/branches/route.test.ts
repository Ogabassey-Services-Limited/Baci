import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const mockToUserAccess = vi.fn();

const MERCHANT_ID = '123e4567-e89b-42d3-a456-426614174001';
const USER_ID = '123e4567-e89b-42d3-a456-426614174002';
const BRANCH_ID = '123e4567-e89b-42d3-a456-426614174003';

const branchRow = {
  id: BRANCH_ID,
  merchant_id: MERCHANT_ID,
  name: 'Lagos main',
  address: null,
  city: 'Lagos',
  state: 'Lagos',
  phone: null,
  manager_id: null,
  is_default: true,
  active: true,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

let listResult: QueryResult;
let insertResult: QueryResult;

type ListQuery = Promise<QueryResult> & {
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

let listQuery: ListQuery;

function createListQuery(): ListQuery {
  const query = Promise.resolve().then(() => listResult) as ListQuery;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  return query;
}

const insertSingle = vi.fn(() => Promise.resolve(insertResult));
const insertSelect = vi.fn(() => ({ single: insertSingle }));
const insert = vi.fn(() => ({ select: insertSelect }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'branches') {
    return Object.assign(listQuery, {
      select: listQuery.select,
      eq: listQuery.eq,
      order: listQuery.order,
      insert,
    });
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

function createRequest(body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://usebaci.com/api/branches', {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function createRawPostRequest(body: string) {
  return new NextRequest('https://usebaci.com/api/branches', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body,
  });
}

describe('/api/branches', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthenticateApiRequest.mockReset();
    mockCheckCsrfProtection.mockReset();
    mockGetMerchantForApiRequest.mockReset();
    mockHasPermission.mockReset();
    mockToUserAccess.mockReset();
    mockFrom.mockClear();
    listQuery = createListQuery();
    insert.mockClear();
    insertSelect.mockClear();
    insertSingle.mockClear();

    listResult = { data: [branchRow], error: null };
    insertResult = { data: branchRow, error: null };
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: USER_ID },
      supabase: { from: mockFrom },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: MERCHANT_ID,
      businessName: 'Baci Store',
      staffAccess: {
        isOwner: false,
        isStaff: true,
        role: 'admin',
        permissions: { settings: { edit: true } },
      },
    });
    mockToUserAccess.mockReturnValue({
      merchantId: MERCHANT_ID,
      role: 'admin',
      isOwner: false,
      isStaff: true,
      permissions: { settings: { edit: true } },
    });
    mockHasPermission.mockReturnValue(true);
  });

  it('lists only active branches for mobile Bearer-authenticated requests', async () => {
    const { GET } = await import('@/app/api/branches/route');
    const request = createRequest(undefined, {
      authorization: 'Bearer mobile-token',
    });

    const response = await GET(request);

    expect(mockAuthenticateApiRequest).toHaveBeenCalledWith(request);
    expect(listQuery.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(listQuery.eq).toHaveBeenCalledWith('active', true);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      branches: [branchRow],
    });
  });

  it('returns 500 when branch listing fails', async () => {
    const { GET } = await import('@/app/api/branches/route');
    listResult.data = null;
    listResult.error = { message: 'Database error', code: 'PGRST001' };

    const response = await GET(createRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to list branches',
    });
  });

  it('returns 401 when authentication fails', async () => {
    const { GET } = await import('@/app/api/branches/route');
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Invalid or expired token',
      user: null,
      supabase: null,
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns a static unauthorized response for branch creation auth failures', async () => {
    const { POST } = await import('@/app/api/branches/route');
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'token parser details',
      user: null,
      supabase: null,
    });

    const response = await POST(createRequest({ name: 'Lagos main' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
    });
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('requires settings.edit for branch creation', async () => {
    const { POST } = await import('@/app/api/branches/route');
    mockHasPermission.mockReturnValue(false);

    const response = await POST(createRequest({ name: 'Lagos main' }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('validates branch creation payloads before inserting', async () => {
    const { POST } = await import('@/app/api/branches/route');

    const response = await POST(createRequest({ name: 'A' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Branch name must be at least 2 characters',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects branch creation names that are invalid after sanitization', async () => {
    const { POST } = await import('@/app/api/branches/route');

    const response = await POST(createRequest({ name: '<b></b>' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Branch name must be at least 2 characters',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('sanitizes valid branch creation names before inserting', async () => {
    const { POST } = await import('@/app/api/branches/route');

    const response = await POST(
      createRequest({ name: '<strong>Lagos main</strong>' })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      branch: branchRow,
    });
    expect(mockCheckCsrfProtection).toHaveBeenCalledWith(expect.any(Request));
    expect(mockGetMerchantForApiRequest).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Lagos main' })
    );
  });

  it('returns 400 for malformed branch creation JSON', async () => {
    const { POST } = await import('@/app/api/branches/route');

    const response = await POST(createRawPostRequest('{'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Malformed JSON' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns 403 and aborts inserts when CSRF validation fails', async () => {
    const { POST } = await import('@/app/api/branches/route');
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'CSRF failed' }), {
        status: 403,
      }),
    });

    const response = await POST(createRequest({ name: 'Lagos main' }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'CSRF failed' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates branches with camelCase API fields mapped to database columns', async () => {
    const { POST } = await import('@/app/api/branches/route');
    const { BRANCH_COLUMNS } = await import(
      '@/app/api/branches/branch-route-utils'
    );

    const response = await POST(
      createRequest({
        name: 'Lagos main',
        city: 'Lagos',
        managerId: '123e4567-e89b-42d3-a456-426614174099',
        isDefault: true,
      })
    );

    expect(mockCheckCsrfProtection).toHaveBeenCalledWith(expect.any(Request));
    expect(insert).toHaveBeenCalledWith({
      merchant_id: MERCHANT_ID,
      name: 'Lagos main',
      address: null,
      city: 'Lagos',
      state: null,
      phone: null,
      manager_id: '123e4567-e89b-42d3-a456-426614174099',
      is_default: true,
    });
    expect(insertSelect).toHaveBeenCalledWith(BRANCH_COLUMNS);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      branch: branchRow,
    });
  });

  it('returns 500 when branch creation fails', async () => {
    const { POST } = await import('@/app/api/branches/route');
    insertResult = {
      data: null,
      error: { message: 'Insert failed', code: 'XX000' },
    };

    const response = await POST(
      createRequest({
        name: 'Lagos main',
        city: 'Lagos',
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to create branch',
    });
  });
});
