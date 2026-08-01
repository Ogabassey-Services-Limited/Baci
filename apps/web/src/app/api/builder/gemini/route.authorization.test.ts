import { generateObject } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockGetAuthenticatedUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();
const merchantId = '11111111-1111-4111-8111-111111111111';

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
  checkRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 9,
    resetIn: 60 * 1000,
  })),
  sanitizePromptInput: vi.fn((prompt: string) => ({ value: prompt })),
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

describe('/api/builder/gemini route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetAuthenticatedUser.mockResolvedValue(null);
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
  });

  it('returns the CSRF response before auth when the token is invalid', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Make it blue', currentConfig: {} }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Invalid CSRF token' });
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('returns 403 when the user lacks builder permissions', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        prompt: 'Make it blue',
        currentConfig: { content: [], root: { title: 'Home' }, zones: {} },
      }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
  });

  it('returns 400 when the AI request body is invalid', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });

    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when the request body is malformed JSON', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });

    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 401 for an unauthenticated malformed body before validating it', async () => {
    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const { POST } = await import('./route');
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('targets the selected merchant when returning generated config', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });

    vi.mocked(generateObject).mockResolvedValue({
      object: {
        content: [{ type: 'Hero', props: { title: 'Updated hero' } }],
        root: { title: 'Updated home' },
        zones: {},
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        prompt: 'Update the hero title',
        currentConfig: {
          content: [{ type: 'Hero', props: { title: 'Home' } }],
          root: { title: 'Home' },
          zones: {},
        },
      }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith({}, 'user-1', {
      requestedMerchantId: merchantId,
    });
    expect(body).toEqual({
      config: {
        content: [
          expect.objectContaining({
            type: 'Hero',
            props: expect.objectContaining({
              title: 'Updated hero',
              id: expect.stringContaining('hero-'),
            }),
          }),
        ],
        root: { title: 'Updated home' },
        zones: {},
        theme: {},
      },
    });
  });
});
