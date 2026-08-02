import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenantMocks = vi.hoisted(() => ({
  resolveSantaTenant: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (name: string) =>
      name === 'x-forwarded-for' || name === 'x-real-ip' ? '127.0.0.1' : null,
  })),
}));

vi.mock('@/ai/provider', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  AI_RATE_LIMITS: { santa: { requests: 10, windowMs: 60000 } },
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  activeTextModel: 'mock-active-model',
  fallbackTextModel: 'mock-fallback-model',
}));

vi.mock('@/ai/santa-data', () => ({
  getCachedSantaProducts: vi.fn(async () => 'Product List Here'),
}));

vi.mock('@/lib/agentic/resolve-santa-tenant', () => ({
  resolveSantaTenant: tenantMocks.resolveSantaTenant,
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: vi.fn((input: string) => input),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc: vi.fn().mockResolvedValue({ error: null }),
  })),
}));

vi.mock('@/ai/prompts/santa', () => ({
  SANTA_ERROR_MESSAGES: {
    general: 'Santa is taking a break. Please try again later!',
  },
}));

import { generateText } from 'ai';
import { getCachedSantaProducts } from '@/ai/santa-data';
import { POST } from './route';

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/chat/santa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat/santa tenant resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantMocks.resolveSantaTenant.mockResolvedValue({
      id: 'merchant-1',
      slug: 'winter-store',
      businessName: 'Winter Store',
    });
    vi.mocked(generateText).mockResolvedValue({
      text: 'Ho ho ho!',
    } as GenerateTextResult);
  });

  it('returns 503 without reading the catalogue when the tenant is unavailable', async () => {
    tenantMocks.resolveSantaTenant.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ messages: [{ role: 'user', content: 'I want a phone!' }] })
    );

    expect(response.status).toBe(503);
    expect(generateText).not.toHaveBeenCalled();
    expect(getCachedSantaProducts).not.toHaveBeenCalled();
  });

  it('uses the resolved tenant for the Santa catalogue', async () => {
    const response = await POST(
      makeRequest({ messages: [{ role: 'user', content: 'I want a phone!' }] })
    );

    expect(response.status).toBe(200);
    expect(getCachedSantaProducts).toHaveBeenCalledWith('merchant-1');
  });

  it('uses the resolved public business name in the Santa prompt', async () => {
    const response = await POST(
      makeRequest({ messages: [{ role: 'user', content: 'I want a phone!' }] })
    );

    expect(response.status).toBe(200);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('gadget company called Winter Store'),
      })
    );
  });
});
