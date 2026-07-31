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

describe('/api/builder/gemini invalid draft output', () => {
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

  it('returns ai_builder_invalid_output when every provider returns off-shape JSON', async () => {
    // content present but not an array → fails aiBuilderConfigSchema validation
    // (a default only fills a missing key, not a present-but-wrong one).
    vi.mocked(generateObject).mockResolvedValue({
      object: { content: 'not-an-array', root: {}, zones: {} },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

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
    // Both providers in the mocked chain were tried before giving up.
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it('falls through off-shape JSON from one provider and succeeds on the next (renderable-config gate)', async () => {
    vi.mocked(generateObject)
      .mockResolvedValueOnce({
        object: { content: 'not-an-array' },
      } as unknown as Awaited<ReturnType<typeof generateObject>>)
      .mockResolvedValueOnce({
        object: {
          content: [{ type: 'Hero', props: { title: 'Updated hero' } }],
          root: { title: 'Home' },
          zones: {},
        },
      } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.content[0].props.title).toBe('Updated hero');
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it('rejects a partial draft (theme only, no content) instead of applying an empty storefront', async () => {
    // A provider returns only `theme`. aiBuilderConfigSchema would default
    // `content` to [] — silently wiping the merchant's page. The route must
    // treat the missing content array as a failed attempt, not a valid draft.
    vi.mocked(generateObject).mockResolvedValue({
      object: { theme: { colors: { primary: '#0000ff' } } },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.code).toBe('ai_builder_invalid_output');
    // Never returns a config with defaulted content (the wipe vector).
    expect(body.config).toBeUndefined();
    // Both providers were tried (the partial draft fell through, not applied).
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it('accepts a valid explicitly-empty config (content: []) — e.g. a cleared or blank page', async () => {
    // An explicit empty array is a legitimate config (blank/new store default,
    // or a "clear the page" request) and must NOT be rejected as a partial
    // draft — only a MISSING content array (masked by schema defaults) is.
    vi.mocked(generateObject).mockResolvedValue({
      object: { content: [], root: { title: 'Home' }, zones: {} },
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.content).toEqual([]);
    // First provider's valid (empty) config is applied — no fall-through.
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(1);
  });

  it('recovers from a partial draft: falls through to a provider that returns content', async () => {
    vi.mocked(generateObject)
      .mockResolvedValueOnce({
        object: { theme: { colors: { primary: '#0000ff' } } },
      } as unknown as Awaited<ReturnType<typeof generateObject>>)
      .mockResolvedValueOnce({
        object: {
          content: [{ type: 'Hero', props: { title: 'Recovered' } }],
          root: { title: 'Home' },
          zones: {},
        },
      } as unknown as Awaited<ReturnType<typeof generateObject>>);

    const { POST } = await import('./route');
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.content[0].props.title).toBe('Recovered');
  });
});
