import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetDomainDNSRecords = vi.fn();
const mockRequireMerchantFeatureAccess = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/go54', () => ({
  getDomainDNSRecords: (...args: unknown[]) => mockGetDomainDNSRecords(...args),
  updateDomainDNSRecords: vi.fn(),
}));

vi.mock('@/lib/merchant-feature-gates', () => ({
  requireMerchantFeatureAccess: (...args: unknown[]) =>
    mockRequireMerchantFeatureAccess(...args),
}));

vi.mock('@/lib/audit-logger', () => ({
  logAudit: vi.fn(),
}));

const { GET, POST } = await import('./route');

describe('GET /api/domains/[domain]/dns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockGetDomainDNSRecords.mockResolvedValue({ records: [] });
    mockRequireMerchantFeatureAccess.mockResolvedValue(null);
  });

  it('uses merchant access context for domain ownership checks (staff regression)', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'domain-1', merchant_id: 'merchant-staff' },
      error: null,
    });
    const eqMerchantMock = vi.fn().mockReturnValue({ single: singleMock });
    const eqDomainMock = vi.fn().mockReturnValue({ eq: eqMerchantMock });

    const supabaseMock = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: eqDomainMock })),
      })),
    };

    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-staff' },
      supabase: supabaseMock,
      error: null,
    });

    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-staff',
      role: 'admin',
      isOwner: false,
      isStaff: true,
      permissions: { settings: { view: true } },
    });

    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest(
      'http://localhost:3000/api/domains/acme.com/dns'
    );
    const response = await GET(request, {
      params: Promise.resolve({ domain: 'acme.com' }),
    });

    expect(response.status).toBe(200);
    expect(eqMerchantMock).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-staff'
    );
  });

  it('returns 403 when user lacks settings view permission', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-staff' },
      supabase: { from: vi.fn() },
      error: null,
    });

    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-staff',
      role: 'sales_rep',
      isOwner: false,
      isStaff: true,
      permissions: {},
    });

    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost:3000/api/domains/acme.com/dns'
    );
    const response = await GET(request, {
      params: Promise.resolve({ domain: 'acme.com' }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 402 before DNS reads when custom domains are locked', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('domain lookup should not run');
      }),
    };
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-staff' },
      supabase,
      error: null,
    });
    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-staff',
      role: 'admin',
      isOwner: false,
      isStaff: true,
      permissions: { settings: { view: true } },
    });
    mockHasPermission.mockReturnValue(true);
    mockRequireMerchantFeatureAccess.mockResolvedValueOnce(
      Response.json(
        {
          code: 'requires_upgrade',
          error: 'Custom domains require Baci Pro',
        },
        { status: 402 }
      )
    );

    const request = new NextRequest(
      'http://localhost:3000/api/domains/acme.com/dns'
    );
    const response = await GET(request, {
      params: Promise.resolve({ domain: 'acme.com' }),
    });

    expect(response.status).toBe(402);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockGetDomainDNSRecords).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns 402 before DNS updates when custom domains are locked', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('domain lookup should not run');
      }),
    };
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-staff' },
      supabase,
      error: null,
    });
    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-staff',
      role: 'admin',
      isOwner: false,
      isStaff: true,
      permissions: { settings: { edit: true } },
    });
    mockHasPermission.mockReturnValue(true);
    mockRequireMerchantFeatureAccess.mockResolvedValueOnce(
      Response.json(
        {
          code: 'requires_upgrade',
          error: 'Custom domains require Baci Pro',
        },
        { status: 402 }
      )
    );

    const request = new NextRequest(
      'http://localhost:3000/api/domains/acme.com/dns',
      {
        method: 'POST',
        body: JSON.stringify({ records: [] }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ domain: 'acme.com' }),
    });

    expect(response.status).toBe(402);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
