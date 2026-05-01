import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module-scope mutable state for controlling mocks ----
let rateLimitAllowed = true;
let rateLimitResetIn = 0;
let generateTextResult = { text: 'AI response' };
let generateTextError: Error | null = null;
let ollamaBaseUrl: string | undefined;
let ollamaBasicAuth: string | undefined;
let ollamaError: Error | null = null;
let ollamaStreamError: Error | null = null;
let ollamaResponseText = 'Gemma response';

// ---- Mocks ----

vi.mock('ai', () => ({
  generateText: vi.fn(() => {
    if (generateTextError) throw generateTextError;
    return Promise.resolve(generateTextResult);
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
  activeTextModel: 'mock-model',
}));

vi.mock('@/env', () => ({
  getAiChatModel: vi.fn(() => 'gemma4:e4b'),
  getOllamaBaseUrl: vi.fn(() => ollamaBaseUrl),
  getOllamaBasicAuth: vi.fn(() => ollamaBasicAuth),
}));

vi.mock('@/lib/ollama-chat', () => ({
  createOllamaChatResponse: vi.fn(() => {
    if (ollamaError) {
      return Promise.reject(ollamaError);
    }

    if (ollamaStreamError) {
      const streamError = ollamaStreamError;

      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.error(streamError);
            },
          }),
          {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          }
        )
      );
    }

    return Promise.resolve(
      new Response(ollamaResponseText, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }),
}));

vi.mock('@/ai/chat-tool-handlers', () => ({
  handleSearchProducts: vi.fn(async () => ({ products: [] })),
  handleGetProductDetails: vi.fn(async () => ({ product: null })),
  handleCreateVirtualAccount: vi.fn(async () => ({ account: null })),
  handleCheckPaymentStatus: vi.fn(async () => ({ status: 'pending' })),
  handleGetRecommendations: vi.fn(async () => ({ recommendations: [] })),
  handleAddToCart: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/ai/chat-tools', () => ({
  searchProductsSchema: { parse: vi.fn() },
  getProductDetailsSchema: { parse: vi.fn() },
  createVirtualAccountSchema: { parse: vi.fn() },
  checkPaymentStatusSchema: { parse: vi.fn() },
  getRecommendationsSchema: { parse: vi.fn() },
  addToCartSchema: { parse: vi.fn() },
  TOOL_DESCRIPTIONS: {
    searchProducts: 'Search products',
    getProductDetails: 'Get product details',
    createVirtualAccount: 'Create virtual account',
    checkPaymentStatus: 'Check payment status',
    getRecommendations: 'Get recommendations',
    addToCart: 'Add to cart',
  },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: vi.fn((input: string) => input),
}));

// ---- Import handler AFTER mocks ----
import { generateText } from 'ai';
import { createOllamaChatResponse } from '@/lib/ollama-chat';
import { sanitizeHtml } from '@/lib/sanitize';
import { POST } from './route';

// ---- Helpers ----

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeAbortedRequest(body: unknown): Request {
  const controller = new AbortController();
  const request = new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  controller.abort();
  return request;
}

function makeInvalidJsonRequest(): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid json',
  });
}

// ---- Tests ----

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitAllowed = true;
    rateLimitResetIn = 0;
    generateTextResult = { text: 'AI response' };
    generateTextError = null;
    ollamaBaseUrl = undefined;
    ollamaBasicAuth = undefined;
    ollamaError = null;
    ollamaStreamError = null;
    ollamaResponseText = 'Gemma response';
  });

  it('returns 429 when rate limited', async () => {
    // Arrange
    rateLimitAllowed = false;
    rateLimitResetIn = 45;

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hi' }],
      })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(429);
    expect(json.error).toBe('Too many requests');
    expect(json.resetIn).toBe(45);
  });

  it('returns 400 for invalid JSON', async () => {
    // Act
    const response = await POST(makeInvalidJsonRequest());
    const json = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid JSON');
  });

  it('returns 400 for missing messages', async () => {
    // Act
    const response = await POST(makeRequest({}));
    const json = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid input');
  });

  it('returns 400 for empty messages array', async () => {
    // Act
    const response = await POST(makeRequest({ messages: [] }));
    const json = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid input');
  });

  it('returns 200 with text/plain response on success', async () => {
    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Show me phones' }],
      })
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8'
    );
    const text = await response.text();
    expect(text).toBe('AI response');
  });

  it('uses VPS Gemma through Ollama when configured', async () => {
    // Arrange
    ollamaBaseUrl = 'https://ollama.example.com';

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Show me phones' }],
      })
    );

    // Assert
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Gemma response');
    expect(createOllamaChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://ollama.example.com',
        model: 'gemma4:e4b',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('VPS-hosted gemma4:e4b'),
          }),
          expect.objectContaining({
            role: 'user',
            content: 'Show me phones',
          }),
        ]),
      })
    );
    expect(generateText).not.toHaveBeenCalled();
  });

  it('falls back to Gemini when the Ollama request fails', async () => {
    // Arrange
    ollamaBaseUrl = 'https://ollama.example.com';
    ollamaError = new Error('Ollama unavailable');
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Show me phones' }],
      })
    );
    const text = await response.text();

    // Assert
    expect(response.status).toBe(200);
    expect(text).toBe('AI response');
    expect(createOllamaChatResponse).toHaveBeenCalledOnce();
    expect(generateText).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Agentic Chat] Ollama request failed; falling back to Gemini:',
      'Ollama unavailable'
    );
    warnSpy.mockRestore();
  });

  it('does not fall back to Gemini when the client aborts the Ollama request', async () => {
    // Arrange
    ollamaBaseUrl = 'https://ollama.example.com';
    ollamaError = new Error('Ollama chat request aborted');
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    // Act
    const response = await POST(
      makeAbortedRequest({
        messages: [{ role: 'user', content: 'Show me phones' }],
      })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(499);
    expect(json.error).toBe('Client Closed Request');
    expect(createOllamaChatResponse).toHaveBeenCalledOnce();
    expect(generateText).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('falls back to Gemini when the Ollama stream fails before completion', async () => {
    // Arrange
    ollamaBaseUrl = 'https://ollama.example.com';
    ollamaStreamError = new Error(
      'Invalid Ollama chat chunk JSON: Unexpected end of JSON input; payloadLength=42'
    );
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Show me phones' }],
      })
    );
    const text = await response.text();

    // Assert
    expect(response.status).toBe(200);
    expect(text).toBe('AI response');
    expect(createOllamaChatResponse).toHaveBeenCalledOnce();
    expect(generateText).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Agentic Chat] Ollama request failed; falling back to Gemini:',
      'Invalid Ollama chat chunk JSON: Unexpected end of JSON input; payloadLength=42'
    );
    warnSpy.mockRestore();
  });

  it('falls back to Gemini when Ollama returns an empty completion', async () => {
    // Arrange
    ollamaBaseUrl = 'https://ollama.example.com';
    ollamaResponseText = '   ';
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Show me phones' }],
      })
    );
    const text = await response.text();

    // Assert
    expect(response.status).toBe(200);
    expect(text).toBe('AI response');
    expect(createOllamaChatResponse).toHaveBeenCalledOnce();
    expect(generateText).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Agentic Chat] Ollama request failed; falling back to Gemini:',
      'Ollama chat returned an empty completion'
    );
    warnSpy.mockRestore();
  });

  it('forwards Ollama Basic Auth when configured', async () => {
    // Arrange
    ollamaBaseUrl = 'https://ollama.example.com';
    ollamaBasicAuth = 'user:password';

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Show me phones' }],
      })
    );

    // Assert
    expect(response.status).toBe(200);
    expect(createOllamaChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        basicAuth: 'user:password',
      })
    );
  });

  it('sanitizes user messages', async () => {
    // Act
    await POST(
      makeRequest({
        messages: [
          { role: 'user', content: '<img onerror=alert(1)>' },
          { role: 'assistant', content: 'Hello!' },
        ],
      })
    );

    // Assert
    expect(sanitizeHtml).toHaveBeenCalledWith('<img onerror=alert(1)>');
    expect(sanitizeHtml).not.toHaveBeenCalledWith('Hello!');
  });

  it('passes all 6 tools to generateText', async () => {
    // Act
    await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Find a laptop' }],
      })
    );

    // Assert
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model',
        system: expect.stringContaining('Ogabassey AI'),
        tools: expect.objectContaining({
          searchProducts: expect.objectContaining({
            description: 'Search products',
          }),
          getProductDetails: expect.objectContaining({
            description: 'Get product details',
          }),
          createVirtualAccount: expect.objectContaining({
            description: 'Create virtual account',
          }),
          checkPaymentStatus: expect.objectContaining({
            description: 'Check payment status',
          }),
          getRecommendations: expect.objectContaining({
            description: 'Get recommendations',
          }),
          addToCart: expect.objectContaining({
            description: 'Add to cart',
          }),
        }),
      })
    );
  });

  it('returns 500 on error', async () => {
    // Arrange
    generateTextError = new Error('Model unavailable');

    // Act
    const response = await POST(
      makeRequest({
        messages: [{ role: 'user', content: 'Hello' }],
      })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
    expect(json.message).toContain('trouble right now');
  });
});
