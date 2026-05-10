import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/get-merchant-for-api-request', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/get-merchant-for-api-request')
  >('@/lib/get-merchant-for-api-request');
  return {
    ...actual,
    getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  };
});

function createSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'job-1', status: 'pending' },
            error: null,
          }),
        }),
      }),
    })),
  };
}

function createPostRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/ai-jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe('POST /api/ai-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: false,
        isStaff: true,
        role: 'manager',
        permissions: {
          products: { create: true },
          builder: { edit: true },
        },
      },
    });
    mocks.createClient.mockReturnValue(createSupabaseMock());
  });

  it('rejects malformed storefront generation input before insert', async () => {
    const response = await POST(
      createPostRequest({
        type: 'storefront_layout_generation',
        input: { pageSlug: 'home', businessName: '' },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({ error: 'Invalid request body' })
    );
  });

  it('creates a storefront generation job with builder edit permission', async () => {
    const response = await POST(
      createPostRequest({
        type: 'storefront_layout_generation',
        input: {
          pageSlug: 'home',
          businessName: 'Bassey Phones',
          businessType: 'electronics',
          brandColors: { primary: '#111827' },
          createdPageConfigUpdatedAt: '2026-04-28T10:00:00.000Z',
        },
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      job: {
        id: 'job-1',
        status: 'pending',
      },
    });
  });

  it('requires builder edit permission for storefront generation jobs', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValueOnce({
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: false,
        isStaff: true,
        role: 'viewer',
        permissions: { builder: { view: true }, products: { create: true } },
      },
    });

    const response = await POST(
      createPostRequest({
        type: 'storefront_layout_generation',
        input: {
          pageSlug: 'home',
          businessName: 'Bassey Phones',
          businessType: 'electronics',
          brandColors: null,
          createdPageConfigUpdatedAt: null,
        },
      })
    );

    expect(response.status).toBe(403);
  });
});
