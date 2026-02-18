import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-scope mutable state for controlling mocks ----
let rateLimitAllowed = true;
let rateLimitResetIn = 0;
let mockProducts = 'Product List Here';
let streamTextError: Error | null = null;

// ---- Mocks ----

vi.mock('ai', () => ({
  streamText: vi.fn(() => {
    if (streamTextError) throw streamTextError;
    return {
      toTextStreamResponse: () =>
        new Response('Ho ho ho!', {
          headers: { 'Content-Type': 'text/plain' },
        }),
    };
  }),
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

vi.mock('@/ai/provider', () => ({
  checkRateLimit: vi.fn(() =>
    rateLimitAllowed
      ? { allowed: true }
      : { allowed: false, resetIn: rateLimitResetIn }
  ),
  AI_RATE_LIMITS: { santa: { requests: 10, windowMs: 60000 } },
  activeTextModel: 'mock-model',
}));

vi.mock('@/ai/santa-data', () => ({
  getCachedSantaProducts: vi.fn(async () => mockProducts),
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

vi.mock('@/ai/prompts/santa', () => ({
  SANTA_ERROR_MESSAGES: {
    general: 'Santa is taking a break. Please try again later!',
  },
}));

// ---- Import handler AFTER mocks ----
import { streamText } from 'ai';
import { sanitizeHtml } from '@/lib/sanitize';
import { POST } from './route';

// ---- Helpers ----

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
    streamTextError = null;
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

  it('returns streaming text response on success', async () => {
    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'I want a phone!' }],
      })
    );

    // Assert
    expect(response.status).toBe(200);
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

  it('calls streamText with correct model and system prompt', async () => {
    // Act
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    );

    // Assert
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model',
        system: expect.stringContaining('Santa Claus'),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hello' }),
        ]),
      })
    );
  });

  it('returns 500 on internal error', async () => {
    // Arrange
    streamTextError = new Error('AI service down');

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
