import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createAdminClient: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  createRateLimitResponse: (
    limit: number,
    remaining: number,
    resetTime: number
  ) => Response.json({ limit, remaining, resetTime }, { status: 429 }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

function createMerchantQuery(result: unknown) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
  };
}

function createAdminMock(options?: {
  merchant?: unknown;
  merchantError?: unknown;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return createMerchantQuery({
          data:
            options && 'merchant' in options
              ? options.merchant
              : { id: 'merchant-1' },
          error: options?.merchantError ?? null,
        });
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({ upload: mocks.upload })),
    },
  };
}

function createRequest(formData: FormData) {
  return {
    formData: vi.fn().mockResolvedValue(formData),
    headers: new Headers(),
    url: 'https://shop.example.com/api/storefront/negotiation-evidence',
  } as unknown as NextRequest;
}

describe('POST /api/storefront/negotiation-evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    mocks.checkRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
    mocks.upload.mockResolvedValue({ data: { path: 'stored' }, error: null });
    mocks.createAdminClient.mockReturnValue(createAdminMock());
  });

  it('uploads accepted proof images to the private evidence bucket', async () => {
    const { NEGOTIATION_EVIDENCE_BUCKET, POST } = await import('./route');
    const formData = new FormData();
    formData.set('merchantId', 'merchant-1');
    formData.set(
      'file',
      new File(['proof'], 'Promo Screenshot.PNG', { type: 'image/png' })
    );

    const response = await POST(createRequest(formData));
    const body = (await response.json()) as { evidencePath: string };

    expect(response.status).toBe(200);
    expect(body.evidencePath).toBe(
      'merchant-1/1700000000000-4fzyo8-promo-screenshot.png'
    );
    const admin = mocks.createAdminClient.mock.results[0].value;
    expect(admin.storage.from).toHaveBeenCalledWith(
      NEGOTIATION_EVIDENCE_BUCKET
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      'merchant-1/1700000000000-4fzyo8-promo-screenshot.png',
      expect.any(ArrayBuffer),
      { contentType: 'image/png', upsert: false }
    );
  });

  it('rejects rate-limited requests before validating merchants', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });
    const { POST } = await import('./route');
    const formData = new FormData();
    formData.set('merchantId', 'merchant-1');
    formData.set(
      'file',
      new File(['proof'], 'proof.png', { type: 'image/png' })
    );

    const response = await POST(createRequest(formData));

    expect(response.status).toBe(429);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types before storage upload', async () => {
    const { POST } = await import('./route');
    const formData = new FormData();
    formData.set('merchantId', 'merchant-1');
    formData.set(
      'file',
      new File(['proof'], 'proof.pdf', { type: 'application/pdf' })
    );

    const response = await POST(createRequest(formData));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Upload a screenshot or photo.');
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects oversized evidence before storage upload', async () => {
    const { POST } = await import('./route');
    const formData = new FormData();
    formData.set('merchantId', 'merchant-1');
    formData.set(
      'file',
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'proof.png', {
        type: 'image/png',
      })
    );

    const response = await POST(createRequest(formData));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Upload a proof image under 10 MB.');
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects uploads for unknown merchant folders', async () => {
    mocks.createAdminClient.mockReturnValueOnce(
      createAdminMock({ merchant: null })
    );
    const { POST } = await import('./route');
    const formData = new FormData();
    formData.set('merchantId', 'merchant-1');
    formData.set(
      'file',
      new File(['proof'], 'proof.png', { type: 'image/png' })
    );

    const response = await POST(createRequest(formData));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Storefront merchant not found.');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
