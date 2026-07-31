import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@/ai/provider';

const mockCheckCsrfProtection = vi.fn();
const mockGetAuthenticatedUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrfProtection,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchantForApiRequest,
  toUserAccess: vi.fn(() => ({ role: 'owner' })),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@/ai/copilot-provider-chain', () => ({
  getCopilotTextProviderChain: vi.fn(() => [
    { name: 'test:primary', model: {} },
    { name: 'test:fallback', model: {} },
  ]),
}));

vi.mock('@/ai/provider', () => ({
  AI_RATE_LIMITS: {
    builder: { requests: 10, windowMs: 60 * 1000 },
  },
  checkRateLimit: vi.fn(),
  sanitizePromptInput: vi.fn((prompt: string) => ({ value: prompt })),
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

function createRequest() {
  return new NextRequest('http://localhost/api/builder/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantId: '11111111-1111-4111-8111-111111111111',
      prompt: 'Make the storefront blue',
      currentConfig: {
        content: [{ type: 'Hero', props: { title: 'Home' } }],
        root: { title: 'Home' },
        zones: {},
      },
    }),
  });
}

describe('/api/builder/gemini structured error codes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 9,
      resetIn: 60 * 1000,
    });
  });

  it('returns rate_limited with a request id', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetIn: 15_000,
    });

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual(
      expect.objectContaining({
        error: 'Rate limit exceeded',
        code: 'rate_limited',
        requestId: expect.any(String),
      })
    );
  });

  it('returns ai_provider_unavailable when every provider in the chain fails', async () => {
    vi.mocked(generateObject).mockRejectedValue(
      new Error('network unavailable')
    );

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        error: 'AI editor is temporarily unavailable',
        code: 'ai_provider_unavailable',
        requestId: expect.any(String),
      })
    );
    // Every provider in the (mocked, 2-entry) chain must be attempted.
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it('returns ai_provider_rate_limited when every provider quota is exhausted', async () => {
    vi.mocked(generateObject).mockRejectedValue(
      new Error(
        'Quota exceeded for metric: generate_content_free_tier_requests'
      )
    );

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual(
      expect.objectContaining({
        error: 'AI editor quota is temporarily exhausted',
        code: 'ai_provider_rate_limited',
        requestId: expect.any(String),
      })
    );
    // A quota failure on the primary must attempt the rest of the chain
    // before 429ing.
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it('succeeds via the next provider when the primary quota is exhausted', async () => {
    vi.mocked(generateObject)
      .mockRejectedValueOnce(
        new Error(
          'Quota exceeded for metric: generate_content_free_tier_requests'
        )
      )
      .mockResolvedValueOnce({
        object: {
          content: [{ type: 'Hero', props: { title: 'Updated hero' } }],
          root: { title: 'Updated home' },
          zones: {},
        },
      } as Awaited<ReturnType<typeof generateObject>>);

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.content[0].props.title).toBe('Updated hero');
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it('succeeds via the next provider on a non-quota failure (provider outage)', async () => {
    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error('upstream 500: internal error'))
      .mockResolvedValueOnce({
        object: {
          content: [{ type: 'Hero', props: { title: 'Updated hero' } }],
          root: { title: 'Updated home' },
          zones: {},
        },
      } as Awaited<ReturnType<typeof generateObject>>);

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.content[0].props.title).toBe('Updated hero');
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it('keeps non-provider route failures out of provider error mapping', async () => {
    mockGetMerchantForApiRequest.mockRejectedValueOnce(
      new Error('Quota exceeded while loading merchant metadata')
    );

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        error: 'Internal server error',
        requestId: expect.any(String),
      })
    );
  });
});
