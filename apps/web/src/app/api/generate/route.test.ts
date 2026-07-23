import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted guarantees this initializes before the hoisted vi.mock calls
// below run (a plain top-level const would TDZ-error: the static `./route`
// import at the bottom resolves before a same-scope const initializer would).
const { mockCheckCsrfProtection } = vi.hoisted(() => ({
  mockCheckCsrfProtection: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: vi.fn() }));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mockCheckCsrfProtection,
}));

// Partial mock of @/ai/provider: the route no longer imports this module
// directly, but the real (unmocked) @/ai/text-provider-chain does, to build
// the platform chain that generateTextWithChain (also real) walks against
// the mocked `ai`.generateText.
vi.mock('@/ai/provider', () => ({
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

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    respondByModel({ 'mock-active-model': 'Generated text' });
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
      makeRequest({ prompt: 'Hello', option: 'continue', command: '' })
    );
    const json = await response.json();

    // Assert
    expect(response.status).toBe(403);
    expect(json.error).toBe('CSRF validation failed');
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns generated text for the "continue" option', async () => {
    // Act
    const response = await POST(
      makeRequest({
        prompt: 'Once upon a time',
        option: 'continue',
        command: '',
      })
    );
    const text = await response.text();

    // Assert
    expect(response.status).toBe(200);
    expect(text).toBe('Generated text');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-active-model',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Once upon a time',
          }),
        ]),
        maxOutputTokens: 400,
        temperature: 0.7,
      })
    );
  });

  it('builds the zap prompt with the user command', async () => {
    // Act
    await POST(
      makeRequest({
        prompt: 'raw text',
        option: 'zap',
        command: 'make it formal',
      })
    );

    // Assert
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('make it formal'),
          }),
        ]),
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
      makeRequest({ prompt: 'Hello', option: 'continue', command: '' })
    );
    const text = await response.text();

    // Assert
    expect(response.status).toBe(500);
    expect(text).toBe('Unable to generate text.');
  });
});
