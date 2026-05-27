import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void Promise.resolve()
        .then(callback)
        .catch(() => undefined);
    },
  };
});

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  loggerError: vi.fn(),
  triggerAiStorefrontWorker: vi.fn(),
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

vi.mock('@/lib/ai-storefront/trigger-storefront-worker', () => ({
  triggerAiStorefrontWorker: mocks.triggerAiStorefrontWorker,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import type { NextRequest } from 'next/server';
import { POST } from './route';

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

async function flushAfterCallbacks() {
  // The mocked after() callback runs in a microtask that schedules the async
  // trigger body in another microtask, so both ticks are intentional.
  await Promise.resolve();
  await Promise.resolve();
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
    mocks.triggerAiStorefrontWorker.mockResolvedValue({
      triggered: true,
      status: 202,
    });
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

  it('triggers the VPS storefront worker after creating a storefront job', async () => {
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

    expect(response.status).toBe(201);
    await flushAfterCallbacks();
    expect(mocks.triggerAiStorefrontWorker).toHaveBeenCalledWith({
      jobId: 'job-1',
      merchantId: 'merchant-1',
      source: 'api',
    });
  });

  it('keeps job creation successful when the storefront trigger fails', async () => {
    mocks.triggerAiStorefrontWorker.mockRejectedValueOnce(
      new Error('trigger unavailable')
    );

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

    expect(response.status).toBe(201);
    await flushAfterCallbacks();
    expect(mocks.triggerAiStorefrontWorker).toHaveBeenCalledWith({
      jobId: 'job-1',
      merchantId: 'merchant-1',
      source: 'api',
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        merchantId: 'merchant-1',
        message: 'AI storefront worker trigger failed',
      })
    );
  });

  it('does not trigger the storefront worker for non-storefront AI jobs', async () => {
    const response = await POST(
      createPostRequest({
        type: 'price_list_processing',
        input: { uploadId: 'upload-1' },
      })
    );

    expect(response.status).toBe(201);
    await flushAfterCallbacks();
    expect(mocks.triggerAiStorefrontWorker).not.toHaveBeenCalled();
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
