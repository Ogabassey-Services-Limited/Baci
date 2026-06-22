import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
  revalidateMerchantFeed: vi.fn(),
  triggerDomainEdgeConfigSync: vi.fn(),
  vercelRemoveDomain: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mocks.after };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mocks.authenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mocks.getUserAccess(...args),
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateMerchantFeed: (...args: unknown[]) =>
    mocks.revalidateMerchantFeed(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));

vi.mock('@/lib/edge-config-sync', () => ({
  triggerDomainEdgeConfigSync: (...args: unknown[]) =>
    mocks.triggerDomainEdgeConfigSync(...args),
}));

vi.mock('@/lib/go54', () => ({
  getDomainInformation: vi.fn(),
  getDomainLock: vi.fn(),
  getDomainNameservers: vi.fn(),
  updateDomainLock: vi.fn(),
  updateDomainNameservers: vi.fn(),
}));

vi.mock('@/lib/vercel', () => ({
  vercel: {
    removeDomain: (...args: unknown[]) => mocks.vercelRemoveDomain(...args),
  },
}));

const { DELETE } = await import('./route');

function createDeleteQuery() {
  type DeleteQuery = Promise<{ error: null }> & {
    eq: (column: string, value: unknown) => DeleteQuery;
  };

  const query = Promise.resolve({ error: null }) as DeleteQuery;
  query.eq = vi.fn(() => query);

  return query;
}

function createSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'domains') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        delete: vi.fn(() => createDeleteQuery()),
      };
    }),
  };
}

function createRequest() {
  return new NextRequest('http://localhost/api/domains/shop.example.com', {
    method: 'DELETE',
  });
}

describe('DELETE /api/domains/[domain]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.authenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: createSupabase(),
      user: { id: 'user-1' },
    });
    mocks.getUserAccess.mockResolvedValue({ merchantId: 'merchant-1' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.vercelRemoveDomain.mockResolvedValue(undefined);
  });

  it('revalidates the merchant feed when deleting a domain succeeds', async () => {
    const response = await DELETE(createRequest(), {
      params: Promise.resolve({ domain: 'shop.example.com' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.revalidateMerchantFeed).toHaveBeenCalledWith('merchant-1');
    expect(mocks.after).toHaveBeenCalled();
  });
});
