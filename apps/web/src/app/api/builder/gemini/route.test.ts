import { generateObject } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withRetry } from '@/ai/provider';

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
  AI_RATE_LIMITS: {
    builder: { requests: 10, windowMs: 60 * 1000 },
  },
  activeTextModel: {},
  checkRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 9,
    resetIn: 60 * 1000,
  })),
  sanitizePromptInput: vi.fn((prompt: string) => ({ value: prompt })),
  withRetry: vi.fn(),
}));

describe('/api/builder/gemini route', () => {
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
      body: JSON.stringify({ prompt: 'Make it blue', currentConfig: {} }),
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

  it('returns generated config for a valid request', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });

    vi.mocked(withRetry).mockImplementation(
      async (fn: () => Promise<unknown>) => fn()
    );
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

  it('deep-merges non-color theme sections from the generated config', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });

    vi.mocked(withRetry).mockImplementation(
      async (fn: () => Promise<unknown>) => fn()
    );
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        content: [],
        root: { title: 'Home' },
        zones: {},
        theme: {
          colors: {
            primary: '#2563eb',
          },
          typography: {
            heading: {
              fontFamily: 'Sora',
            },
          },
          spacing: {
            section: {
              paddingY: '6rem',
            },
          },
        },
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Refresh the visual design',
        currentConfig: {
          content: [],
          root: { title: 'Home' },
          zones: {},
          theme: {
            colors: {
              primary: '#000000',
              footer: { text: '#ffffff' },
            },
            typography: {
              heading: {
                fontFamily: 'Inter',
                fontWeight: '700',
              },
            },
            spacing: {
              section: {
                paddingX: '2rem',
              },
            },
          },
        },
      }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.theme).toEqual({
      colors: {
        primary: '#2563eb',
        footer: { text: '#ffffff' },
      },
      typography: {
        heading: {
          fontFamily: 'Sora',
          fontWeight: '700',
        },
      },
      spacing: {
        section: {
          paddingX: '2rem',
          paddingY: '6rem',
        },
      },
    });
  });
});
