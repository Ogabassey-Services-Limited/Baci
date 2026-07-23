import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted guarantees these initialize before the hoisted vi.mock calls
// below run (a plain top-level const would TDZ-error: the static `./route`
// import at the bottom resolves before a same-scope const initializer would).
const {
  mockGetAuthenticatedUser,
  mockCheckRateLimit,
  mockHandleRequest,
  mockOpenAIConstructor,
  mockOpenAIAdapterCtor,
  mockGoogleAdapterCtor,
  mockCopilotRuntimeEndpoint,
} = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHandleRequest: vi.fn(),
  mockOpenAIConstructor: vi.fn(),
  mockOpenAIAdapterCtor: vi.fn(),
  mockGoogleAdapterCtor: vi.fn(),
  mockCopilotRuntimeEndpoint: vi.fn(),
}));

vi.mock('@/lib/supabase/mobile-auth', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

// Partial mock of @/ai/provider: the route consumes AI_RATE_LIMITS +
// checkRateLimit directly; the real (unmocked) @/ai/text-provider-chain
// (only its getCerebrasTextModelName/getGroqTextModelName helpers are used
// here, never getTextProviderChain) also statically imports the model
// exports below, so they're included for safety even though this route
// never triggers a code path that reads them.
vi.mock('@/ai/provider', () => ({
  AI_RATE_LIMITS: { builder: { requests: 10, windowMs: 60 * 1000 } },
  checkRateLimit: mockCheckRateLimit,
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  activeTextModel: 'mock-active-model',
  fallbackTextModel: 'mock-fallback-model',
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor(opts: unknown) {
      mockOpenAIConstructor(opts);
    }
  },
}));

vi.mock('@copilotkit/runtime', () => {
  // Real classes, not vi.fn().mockImplementation(arrowFn) — the route calls
  // these with `new`, and arrow functions can never be constructors.
  class MockGoogleGenerativeAIAdapter {
    constructor(opts: unknown) {
      mockGoogleAdapterCtor(opts);
      Object.assign(this, opts as object);
    }
  }
  class MockOpenAIAdapter {
    constructor(opts: unknown) {
      mockOpenAIAdapterCtor(opts);
      Object.assign(this, opts as object);
    }
  }
  return {
    CopilotRuntime: vi.fn(),
    copilotRuntimeNextJSAppRouterEndpoint: vi.fn((opts: unknown) => {
      mockCopilotRuntimeEndpoint(opts);
      return { handleRequest: mockHandleRequest };
    }),
    GoogleGenerativeAIAdapter: MockGoogleGenerativeAIAdapter,
    OpenAIAdapter: MockOpenAIAdapter,
  };
});

import { POST, resolveCopilotKitAdapter } from './route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/copilotkit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

describe('resolveCopilotKitAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers Cerebras via an OpenAI-compatible adapter when CEREBRAS_API_KEY is set', () => {
    // Arrange
    vi.stubEnv('CEREBRAS_API_KEY', 'csk-test');
    vi.stubEnv('GROQ_API_KEY', '');

    // Act
    resolveCopilotKitAdapter();

    // Assert
    expect(mockOpenAIConstructor).toHaveBeenCalledWith({
      apiKey: 'csk-test',
      baseURL: 'https://api.cerebras.ai/v1',
    });
    expect(mockOpenAIAdapterCtor).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemma-4-31b' })
    );
    expect(mockGoogleAdapterCtor).not.toHaveBeenCalled();
  });

  it('falls back to Groq via an OpenAI-compatible adapter when only GROQ_API_KEY is set', () => {
    // Arrange
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');

    // Act
    resolveCopilotKitAdapter();

    // Assert
    expect(mockOpenAIConstructor).toHaveBeenCalledWith({
      apiKey: 'gsk-test',
      baseURL: 'https://api.groq.com/openai/v1',
    });
    expect(mockOpenAIAdapterCtor).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-oss-120b' })
    );
    expect(mockGoogleAdapterCtor).not.toHaveBeenCalled();
  });

  it('prefers Groq (production-tier) over Cerebras (preview) when both keys are configured', () => {
    // The CopilotKit sidebar binds a single adapter with no in-request
    // fallback, so the more reliable production endpoint (Groq) is chosen over
    // the preview Cerebras endpoint.
    // Arrange
    vi.stubEnv('CEREBRAS_API_KEY', 'csk-test');
    vi.stubEnv('GROQ_API_KEY', 'gsk-test');

    // Act
    resolveCopilotKitAdapter();

    // Assert
    expect(mockOpenAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://api.groq.com/openai/v1' })
    );
  });

  it('falls back to the direct Gemini adapter when no cloud key is configured', () => {
    // Arrange
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');

    // Act
    resolveCopilotKitAdapter();

    // Assert
    expect(mockGoogleAdapterCtor).toHaveBeenCalledWith({
      model: 'gemini-3-flash-preview',
    });
    expect(mockOpenAIAdapterCtor).not.toHaveBeenCalled();
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
  });
});

describe('POST /api/copilotkit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase: {},
    });
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 9,
      resetIn: 60000,
    });
    mockHandleRequest.mockResolvedValue(
      new Response('copilotkit-ok', { status: 200 })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when the caller is not authenticated', async () => {
    // Arrange
    mockGetAuthenticatedUser.mockResolvedValue(null);

    // Act
    const response = await POST(makeRequest());
    const json = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockHandleRequest).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-user rate limit is exceeded', async () => {
    // Arrange
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetIn: 45000,
    });

    // Act
    const response = await POST(makeRequest());
    const json = await response.json();

    // Assert
    expect(response.status).toBe(429);
    expect(json.error).toBe('Rate limit exceeded');
    expect(mockCheckRateLimit).toHaveBeenCalledWith('copilotkit:user-1', {
      requests: 10,
      windowMs: 60 * 1000,
    });
    expect(mockHandleRequest).not.toHaveBeenCalled();
  });

  it('passes the request through to the CopilotKit endpoint when authorized', async () => {
    // Act
    const response = await POST(makeRequest());
    const text = await response.text();

    // Assert
    expect(response.status).toBe(200);
    expect(text).toBe('copilotkit-ok');
    expect(mockHandleRequest).toHaveBeenCalledTimes(1);
    expect(mockCopilotRuntimeEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/copilotkit' })
    );
  });
});
