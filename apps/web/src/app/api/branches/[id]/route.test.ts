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

let singleResult: QueryResult;
let updateResult: QueryResult;
let rpcResult: QueryResult;

const single = vi.fn(() => Promise.resolve(singleResult));
const getQuery = {
  select: vi.fn(() => getQuery),
  eq: vi.fn(() => getQuery),
  single,
};
const updateSingle = vi.fn(() => Promise.resolve(updateResult));
const updateSelect = vi.fn(() => ({ single: updateSingle }));
const updateEq = vi.fn(() => ({ eq: updateEq, select: updateSelect }));
const update = vi.fn(() => ({ eq: updateEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'branches') {
    return {
      select: getQuery.select,
      eq: getQuery.eq,
      single: getQuery.single,
      update,
    };
  }

  throw new Error(`Unexpected table ${table}`);
});
const mockRpc = vi.fn(() => Promise.resolve(rpcResult));

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

function createRequest(method: string, body?: unknown) {
  return new NextRequest(`https://usebaci.com/api/branches/${BRANCH_ID}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function createMalformedJsonRequest(method: string) {
  return new NextRequest(`https://usebaci.com/api/branches/${BRANCH_ID}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
}

function routeParams(id = BRANCH_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/branches/[id]', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthenticateApiRequest.mockReset();
    mockCheckCsrfProtection.mockReset();
    mockGetMerchantForApiRequest.mockReset();
    mockHasPermission.mockReset();
    mockToUserAccess.mockReset();
    mockFrom.mockClear();
    mockRpc.mockClear();
    getQuery.select.mockClear();
    getQuery.eq.mockClear();
    getQuery.single.mockClear();
    single.mockClear();
    update.mockClear();
    updateEq.mockClear();
    updateSelect.mockClear();
    updateSingle.mockClear();

    singleResult = { data: branchRow, error: null };
    updateResult = { data: branchRow, error: null };
    rpcResult = { data: branchRow, error: null };
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: USER_ID },
      supabase: { from: mockFrom, rpc: mockRpc },
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

  it('fetches active merchant branches without wildcard selects', async () => {
    const { GET } = await import('@/app/api/branches/[id]/route');

    const response = await GET(createRequest('GET'), routeParams());

    expect(mockAuthenticateApiRequest).toHaveBeenCalled();
    expect(getQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining('*')
    );
    expect(getQuery.eq).toHaveBeenCalledWith('id', BRANCH_ID);
    expect(getQuery.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(getQuery.eq).toHaveBeenCalledWith('active', true);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      branch: branchRow,
    });
  });

  it('rejects invalid branch ids before querying', async () => {
    const { GET } = await import('@/app/api/branches/[id]/route');

    const response = await GET(createRequest('GET'), routeParams('not-a-uuid'));

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('requires settings.edit to fetch branch details', async () => {
    const { GET } = await import('@/app/api/branches/[id]/route');
    mockHasPermission.mockReturnValue(false);

    const response = await GET(createRequest('GET'), routeParams());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(mockHasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: MERCHANT_ID }),
      'settings',
      'edit'
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 500 for branch read errors other than missing rows', async () => {
    const { GET } = await import('@/app/api/branches/[id]/route');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    singleResult = {
      data: null,
      error: { code: 'PGRST000', message: 'database unavailable' },
    };

    try {
      const response = await GET(createRequest('GET'), routeParams());

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: 'Internal server error',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Branches] Failed fetching branch',
        expect.objectContaining({
          branchId: BRANCH_ID,
          error: singleResult.error,
          merchantId: MERCHANT_ID,
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('requires settings.edit for branch updates', async () => {
    const { PUT } = await import('@/app/api/branches/[id]/route');
    mockHasPermission.mockReturnValue(false);

    const response = await PUT(
      createRequest('PUT', { name: 'Updated branch' }),
      routeParams()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates branches without allowing active mutations', async () => {
    const { PUT } = await import('@/app/api/branches/[id]/route');

    const response = await PUT(
      createRequest('PUT', {
        name: 'Updated branch',
        active: false,
      }),
      routeParams()
    );

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects branch update names that are invalid after sanitization', async () => {
    const { PUT } = await import('@/app/api/branches/[id]/route');

    const response = await PUT(
      createRequest('PUT', { name: '<b></b>' }),
      routeParams()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Branch name must be at least 2 characters',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed update JSON', async () => {
    const { PUT } = await import('@/app/api/branches/[id]/route');

    const response = await PUT(
      createMalformedJsonRequest('PUT'),
      routeParams()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Malformed JSON',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates branch fields through active-scoped merchant rows', async () => {
    const { PUT } = await import('@/app/api/branches/[id]/route');

    const response = await PUT(
      createRequest('PUT', {
        name: 'Updated branch',
        managerId: null,
        isDefault: true,
      }),
      routeParams()
    );

    expect(update).toHaveBeenCalledWith({
      name: 'Updated branch',
      manager_id: null,
      is_default: true,
    });
    expect(updateEq).toHaveBeenCalledWith('id', BRANCH_ID);
    expect(updateEq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(updateEq).toHaveBeenCalledWith('active', true);
    expect(updateSelect).toHaveBeenCalledWith(expect.not.stringContaining('*'));
    expect(response.status).toBe(200);
  });

  it('clears optional branch metadata when blank update fields are submitted', async () => {
    const { PUT } = await import('@/app/api/branches/[id]/route');

    const response = await PUT(
      createRequest('PUT', {
        address: ' ',
        city: '',
        state: ' ',
        phone: '',
      }),
      routeParams()
    );

    expect(update).toHaveBeenCalledWith({
      address: null,
      city: null,
      state: null,
      phone: null,
    });
    expect(updateEq).toHaveBeenCalledWith('id', BRANCH_ID);
    expect(updateEq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(updateEq).toHaveBeenCalledWith('active', true);
    expect(updateSelect).toHaveBeenCalledWith(expect.not.stringContaining('*'));
    expect(response.status).toBe(200);
  });

  it('sanitizes valid branch update names before updating', async () => {
    const { PUT } = await import('@/app/api/branches/[id]/route');

    const response = await PUT(
      createRequest('PUT', { name: '<strong>My Branch</strong>' }),
      routeParams()
    );

    expect(update).toHaveBeenCalledWith({ name: 'My Branch' });
    expect(updateEq).toHaveBeenCalledWith('id', BRANCH_ID);
    expect(updateEq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(updateEq).toHaveBeenCalledWith('active', true);
    expect(updateSelect).toHaveBeenCalledWith(expect.not.stringContaining('*'));
    expect(response.status).toBe(200);
  });

  it('soft-deactivates branches through the database RPC only', async () => {
    const { DELETE } = await import('@/app/api/branches/[id]/route');

    const response = await DELETE(createRequest('DELETE'), routeParams());

    expect(getQuery.select).toHaveBeenCalledWith('id');
    expect(getQuery.eq).toHaveBeenCalledWith('id', BRANCH_ID);
    expect(getQuery.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(getQuery.eq).toHaveBeenCalledWith('active', true);
    expect(mockRpc).toHaveBeenCalledWith('deactivate_branch', {
      p_branch_id: BRANCH_ID,
    });
    expect(mockFrom).not.toHaveBeenCalledWith('virtual_terminals');
    expect(update).not.toHaveBeenCalledWith({ active: false });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('does not call the deactivation RPC for a branch outside the merchant context', async () => {
    const { DELETE } = await import('@/app/api/branches/[id]/route');
    singleResult = {
      data: null,
      error: { code: 'PGRST116', message: 'Branch not found' },
    };

    const response = await DELETE(createRequest('DELETE'), routeParams());

    expect(response.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns a conflict when the database rejects last active branch deactivation', async () => {
    const { DELETE } = await import('@/app/api/branches/[id]/route');
    rpcResult = {
      data: null,
      error: {
        code: '23514',
        message: 'Cannot deactivate the only active branch',
      },
    };

    const response = await DELETE(createRequest('DELETE'), routeParams());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot deactivate the only active branch',
    });
  });
});
