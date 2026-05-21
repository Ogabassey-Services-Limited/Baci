import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, withRetry } from '@/ai/provider';

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

vi.mock('@/ai/provider', () => ({
  ACTIVE_TEXT_MODEL_NAME: 'gemini-3-flash-preview',
  AI_RATE_LIMITS: {
    builder: { requests: 10, windowMs: 60 * 1000 },
  },
  activeTextModel: {},
  checkRateLimit: vi.fn(),
  sanitizePromptInput: vi.fn((prompt: string) => ({ value: prompt })),
  withRetry: vi.fn(),
}));

function createRequest() {
  return new NextRequest('http://localhost/api/builder/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    vi.mocked(withRetry).mockImplementation(
      async (fn: () => Promise<unknown>) => fn()
    );
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

  it('returns ai_provider_unavailable when provider generation fails', async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(
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
  });

  it('returns ai_provider_rate_limited when Gemini quota is exhausted', async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(
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
  });

  it('returns ai_builder_invalid_output when generated content is malformed', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        root: { title: 'Home' },
        zones: {},
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual(
      expect.objectContaining({
        error: 'AI editor returned an invalid draft',
        code: 'ai_builder_invalid_output',
        requestId: expect.any(String),
      })
    );
  });
});
