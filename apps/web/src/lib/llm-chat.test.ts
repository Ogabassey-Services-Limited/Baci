import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlmChatResponse } from '@/lib/llm-chat';

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

const VALID_BEARER = 'a'.repeat(64);

describe('createLlmChatResponse', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ---------- URL construction ----------

  it('appends /v1/chat/completions to a baseUrl without trailing slash', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      expect.anything()
    );
  });

  it('appends /v1/chat/completions to a baseUrl WITH a trailing slash (no double slash)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://llm.example.com/',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      expect.anything()
    );
  });

  it('does not double the /v1 prefix when baseUrl already includes it', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://host:8080/v1',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://host:8080/v1/chat/completions',
      expect.anything()
    );
  });

  it('also strips a trailing /v1/ (with slash) from baseUrl', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://host:8080/v1/',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://host:8080/v1/chat/completions',
      expect.anything()
    );
  });

  it('preserves query parameters (e.g. tenant=a) when appending the path', async () => {
    // Regression for the raw-string-concat bug where
    //   `https://host?tenant=a` + `/v1/chat/completions`
    // produced `...?tenant=a/v1/chat/completions` (the suffix landed
    // inside the query string, not after the path).
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://llm.example.com?tenant=a',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions?tenant=a',
      expect.anything()
    );
  });

  it('preserves fragments when normalizing a /v1 baseUrl', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://llm.example.com/v1#frag',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions#frag',
      expect.anything()
    );
  });

  it('works with an http://localhost loopback baseUrl', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'http://localhost:11500',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11500/v1/chat/completions',
      expect.anything()
    );
  });

  // ---------- Bearer auth ----------

  it('sends Authorization: Bearer <token> header', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${VALID_BEARER}`,
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('rejects malformed bearer tokens before calling fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      createLlmChatResponse({
        baseUrl: 'https://llm.example.com',
        bearer: 'token\nwith-newline',
        model: 'gemma-4-e4b',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow(/bearer/i);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---------- OpenAI request body shape ----------

  it('sends an OpenAI chat-completions body (model + messages + stream:true)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ],
    });

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.model).toBe('gemma-4-e4b');
    expect(body.stream).toBe(true);
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ]);
    // Ollama-only fields must NOT leak into the OpenAI request
    expect(body).not.toHaveProperty('keep_alive');
    expect(body).not.toHaveProperty('options');
  });

  it('strips line breaks and surrounding whitespace from the model name', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('data: [DONE]\n\n')));
    vi.stubGlobal('fetch', mockFetch);

    await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: '  gemma-4-e4b\n',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.model).toBe('gemma-4-e4b');
  });
});
