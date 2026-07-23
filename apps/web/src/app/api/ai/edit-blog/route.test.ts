import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted guarantees these initialize before the hoisted vi.mock calls
// below run (a plain top-level const would TDZ-error: the static `./route`
// import at the bottom resolves before a same-scope const initializer would).
const { mockCheckCsrfProtection, mockGetUser } = vi.hoisted(() => ({
  mockCheckCsrfProtection: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: vi.fn() }));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    get: () => null,
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrfProtection,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Partial mock of @/ai/provider: the route consumes sanitizePromptInput
// directly; the real (unmocked) @/ai/text-provider-chain consumes the model
// exports below to build the platform chain that generateTextWithChain (also
// real) walks against the mocked `ai`.generateText.
vi.mock('@/ai/provider', () => ({
  sanitizePromptInput: vi.fn((input: string) => ({ value: input })),
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  activeTextModel: 'mock-active-model',
  fallbackTextModel: 'mock-fallback-model',
}));

import { generateText } from 'ai';
import { POST } from './route';

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

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/edit-blog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai/edit-blog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    respondByModel({ 'mock-active-model': '<p>Edited content</p>' });
  });

  it('returns the CSRF response when the token is invalid', async () => {
    // Arrange
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
    });

    // Act
    const response = await POST(
      makeRequest({ content: '<p>Hello</p>', instruction: '' })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(json.error).toBe('CSRF validation failed');
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns 401 when the user is not authenticated', async () => {
    // Arrange
    mockGetUser.mockResolvedValue({ data: { user: null } });

    // Act
    const response = await POST(
      makeRequest({ content: '<p>Hello</p>', instruction: '' })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when content is missing', async () => {
    // Act
    const response = await POST(makeRequest({ instruction: 'Make it punchy' }));
    const json = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(json.error).toBe('Content required');
  });

  it('returns the edited content on success', async () => {
    // Act
    const response = await POST(
      makeRequest({ content: '<p>Original</p>', instruction: '' })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(json.content).toBe('<p>Edited content</p>');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-active-model',
        system: expect.stringContaining('blog post editor'),
        prompt: expect.stringContaining('Original'),
      })
    );
  });

  it('includes the sanitized instruction in the prompt when provided', async () => {
    // Act
    await POST(
      makeRequest({ content: '<p>Original</p>', instruction: 'Make it punchy' })
    );

    // Assert
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Instruction: Make it punchy'),
      })
    );
  });

  it('returns 500 when every provider in the chain fails', async () => {
    // Arrange
    respondByModel({
      'mock-active-model': new Error('down'),
      'mock-fallback-model': new Error('down'),
    });

    // Act
    const response = await POST(
      makeRequest({ content: '<p>Original</p>', instruction: '' })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to process AI edit request');
  });
});
