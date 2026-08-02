import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
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

  it('deep-merges non-color theme sections from the generated config', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });

    vi.mocked(generateObject).mockResolvedValue({
      object: {
        // Realistic copilot output returns the existing content; this test
        // isolates theme merging. (The route rejects a MISSING content array —
        // the default-masking wipe — but accepts an explicit empty [].)
        content: [{ type: 'Hero', props: { title: 'Home' } }],
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
        merchantId,
        prompt: 'Refresh the visual design',
        currentConfig: {
          content: [{ type: 'Hero', props: { title: 'Home' } }],
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

  it('preserves existing zones when the model omits them (no nested-content wipe)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });

    // Model returns valid content + root but NO `zones` key. Without the guard,
    // builderConfigSchema would default zones to {} and wipe the merchant's
    // nested/dropzone content.
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        content: [{ type: 'Hero', props: { title: 'Updated' } }],
        root: { title: 'Home' },
      },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const existingZones = {
      'hero-dropzone': [{ type: 'Text', props: { text: 'Nested' } }],
    };

    const request = new NextRequest('http://localhost/api/builder/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        prompt: 'Update the hero title',
        currentConfig: {
          content: [{ type: 'Hero', props: { title: 'Home' } }],
          root: { title: 'Home' },
          zones: existingZones,
        },
      }),
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.zones).toEqual(existingZones);
  });
});
