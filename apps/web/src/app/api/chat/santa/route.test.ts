import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-scope mutable state for controlling mocks ----
let rateLimitAllowed = true;
let rateLimitResetIn = 0;
let mockProducts = 'Product List Here';
let mockProductsError: Error | null = null;

// ---- Mocks ----

vi.mock('ai', () => ({ generateText: vi.fn() }));

// `after` requires a request scope that vitest does not provide; no-op it so the
// route returns normally (the log itself is covered by santa-interaction-log.test.ts).
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'x-forwarded-for') return '127.0.0.1';
      if (name === 'x-real-ip') return '127.0.0.1';
      return null;
    },
  })),
}));

// Partial mock of @/ai/provider: santa/route.ts consumes checkRateLimit +
// AI_RATE_LIMITS directly; the real (unmocked) @/ai/text-provider-chain
// consumes the model exports below to build the real provider chain, so
// generateTextWithChain runs for real against the mocked `ai`.generateText.
vi.mock('@/ai/provider', () => ({
  checkRateLimit: vi.fn(() =>
    rateLimitAllowed
      ? { allowed: true }
      : { allowed: false, resetIn: rateLimitResetIn }
  ),
  AI_RATE_LIMITS: { santa: { requests: 10, windowMs: 60000 } },
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  activeTextModel: 'mock-active-model',
  fallbackTextModel: 'mock-fallback-model',
}));

vi.mock('@/ai/santa-data', () => ({
  getCachedSantaProducts: vi.fn(async () => {
    if (mockProductsError) throw mockProductsError;
    return mockProducts;
  }),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: vi.fn((input: string) => input),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  })),
}));

// The Santa tenant is resolved slug -> id on a plain anon client. Without this
// mock the real factory builds a live client and the whole suite breaks.
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: '3bc72679-c0f7-4db4-9054-6a4a4a95a498' },
              error: null,
            }),
        }),
      }),
    }),
  })),
}));

vi.mock('@/ai/prompts/santa', () => ({
  SANTA_ERROR_MESSAGES: {
    general: 'Santa is taking a break. Please try again later!',
  },
}));

// ---- Import handler AFTER mocks ----
import { generateText } from 'ai';
import { resetAgenticMerchantIdCache } from '@/lib/agentic/agentic-merchant-id';
import { sanitizeHtml } from '@/lib/sanitize';
import { POST } from './route';

// ---- Helpers ----

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;

function respondByModel(map: Record<string, string | Error>) {
  vi.mocked(generateText).mockImplementation(((opts: { model: string }) => {
    const behavior = map[opts.model];
    if (behavior instanceof Error) {
      return Promise.reject(behavior);
    }
    return Promise.resolve({ text: behavior } as GenerateTextResult);
  }) as unknown as typeof generateText);
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/chat/santa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request('http://localhost:3000/api/chat/santa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not valid json{{{',
  });
}

// ---- Tests ----

describe('POST /api/chat/santa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitAllowed = true;
    rateLimitResetIn = 0;
    mockProducts = 'Product List Here';
    mockProductsError = null;
    resetAgenticMerchantIdCache();
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    // Default: the leading (active) provider succeeds immediately.
    respondByModel({ 'mock-active-model': 'Ho ho ho!' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    // Arrange
    rateLimitAllowed = false;
    rateLimitResetIn = 30;

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello Santa!' }],
      })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(429);
    expect(json.error).toBe('Too many requests');
    expect(json.resetIn).toBe(30);
  });

  it('returns 400 for invalid JSON body', async () => {
    // Act
    const response = await POST(makeInvalidJsonRequest());
    const json = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid JSON');
  });

  it('returns 400 when messages array is empty', async () => {
    // Act
    const response = await POST(makeRequest({ messages: [] }));
    const json = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid input');
  });

  it('returns 400 when message content exceeds 10000 chars', async () => {
    // Arrange
    const longContent = 'a'.repeat(10001);

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: longContent }],
      })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid input');
  });

  it('returns a buffered text response on success', async () => {
    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'I want a phone!' }],
      })
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8'
    );
    const text = await response.text();
    expect(text).toBe('Ho ho ho!');
  });

  it('sanitizes user messages via sanitizeHtml', async () => {
    // Act
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: '<script>alert("xss")</script>' }],
      })
    );

    // Assert
    expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>');
  });

  it('calls generateText with the active model, system prompt, and abort signal', async () => {
    // Act
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    );

    // Assert
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-active-model',
        system: expect.stringContaining('Santa Claus'),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hello' }),
        ]),
        abortSignal: expect.any(AbortSignal),
      })
    );
  });

  it('instructs full-price grants to use the catalog selling price', async () => {
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'My budget covers the phone' }],
      })
    );

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('PRICE:[Selling Price]'),
      })
    );
  });

  it('fails closed without invoking the model when the tenant is unconfigured', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', '');
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', '');
    resetAgenticMerchantIdCache();

    const response = await POST(
      makeRequest({ messages: [{ role: 'user', content: 'I want a phone' }] })
    );

    expect(response.status).toBe(500);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('fails closed without invoking the model when the catalog lookup fails', async () => {
    mockProductsError = new Error('catalog unavailable');

    const response = await POST(
      makeRequest({ messages: [{ role: 'user', content: 'I want a phone' }] })
    );

    expect(response.status).toBe(500);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('falls through to the fallback model when the active model fails', async () => {
    // Arrange - keyless test env resolves to [google active, google fallback]
    respondByModel({
      'mock-active-model': new Error('429 rate limited'),
      'mock-fallback-model': 'Fallback ho ho ho!',
    });

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'I want a phone!' }],
      })
    );
    const text = await response.text();

    // Assert
    expect(response.status).toBe(200);
    expect(text).toBe('Fallback ho ho ho!');
  });

  it('returns 500 when every provider in the chain fails', async () => {
    // Arrange
    respondByModel({
      'mock-active-model': new Error('AI service down'),
      'mock-fallback-model': new Error('AI service down'),
    });

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hi' }],
      })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
    expect(json.message).toBe(
      'Santa is taking a break. Please try again later!'
    );
  });
});
