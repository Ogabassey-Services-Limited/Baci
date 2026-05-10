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

  // ---------- SSE parsing ----------

  it('streams text content from OpenAI SSE delta chunks', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      '',
      'data: [DONE]',
      '',
      '',
    ].join('\n');

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText(sse)));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('Hello world');
  });

  it('ignores SSE chunks without delta content (e.g. role-only first chunk)', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"answer"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText(sse)));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('answer');
  });

  it('terminates cleanly on the [DONE] sentinel and ignores following chunks', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"early"}}]}',
      '',
      'data: [DONE]',
      '',
      'data: {"choices":[{"delta":{"content":"late — should be ignored"}}]}',
      '',
    ].join('\n');

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText(sse)));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('early');
  });

  it('cancels the upstream body after an early [DONE] sentinel', async () => {
    const cancel = vi.fn();
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              'data: {"choices":[{"delta":{"content":"early"}}]}',
              '',
              'data: [DONE]',
              '',
              'data: {"choices":[{"delta":{"content":"late"}}]}',
              '',
            ].join('\n')
          )
        );
      },
      cancel,
    });
    const mockFetch = vi.fn().mockResolvedValue(new Response(upstream));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('early');
    expect(cancel).toHaveBeenCalled();
  });

  it('surfaces malformed SSE payloads without leaking the chunk content', async () => {
    expect.assertions(3);
    const sse =
      'data: {"choices":[{"delta":{"content":"customer phone secret"\n\n';
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText(sse)));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    try {
      await response.text();
      throw new Error('Expected malformed SSE chunk to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw error;
      expect(error.message).toMatch(/Invalid LLM chat chunk JSON/i);
      expect(error.message).not.toContain('customer phone secret');
    }
  });

  it('sanitizes streamed upstream error chunks before rejecting', async () => {
    expect.assertions(5);
    const verboseMessage = `<html>\n${'stack trace '.repeat(40)}</html>`;
    const sse = `data: ${JSON.stringify({
      error: { message: verboseMessage },
    })}\n\n`;
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText(sse)));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    try {
      await response.text();
      throw new Error('Expected streamed error chunk to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw error;
      expect(error.message).toContain('<html>');
      expect(error.message).not.toContain('\n');
      expect(error.message.length).toBeLessThanOrEqual(201);
      expect(error.message).toMatch(/…$/);
    }
  });

  // ---------- Timeout / abort ----------

  it('uses a 90-second default timeout', async () => {
    vi.useFakeTimers();
    let rejection: unknown;
    const mockFetch = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('Aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true }
          );
        })
    );
    vi.stubGlobal('fetch', mockFetch);

    const request = createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    }).catch((error: unknown) => {
      rejection = error;
    });

    await vi.advanceTimersByTimeAsync(89_999);
    expect(rejection).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    await request;

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe('LLM chat request timed out');
  });

  it('maps timeouts to the documented message even when fetch rejects with signal.reason (undici)', async () => {
    vi.useFakeTimers();
    let rejection: unknown;
    const mockFetch = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true }
          );
        })
    );
    vi.stubGlobal('fetch', mockFetch);

    const request = createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
      timeoutMs: 25,
    }).catch((error: unknown) => {
      rejection = error;
    });

    await vi.advanceTimersByTimeAsync(25);
    await request;

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe('LLM chat request timed out');
    expect((rejection as Error).name).not.toBe('TimeoutError');
  });

  it('maps upstream cancellations to the documented aborted message', async () => {
    let rejection: unknown;
    const mockFetch = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true }
          );
        })
    );
    vi.stubGlobal('fetch', mockFetch);

    const upstream = new AbortController();
    const request = createLlmChatResponse({
      baseUrl: 'https://llm.example.com',
      bearer: VALID_BEARER,
      model: 'gemma-4-e4b',
      messages: [{ role: 'user', content: 'Hi' }],
      signal: upstream.signal,
    }).catch((error: unknown) => {
      rejection = error;
    });

    upstream.abort(new DOMException('user cancelled', 'AbortError'));
    await request;

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe('LLM chat request aborted');
  });

  // ---------- HTTP error handling ----------

  it('throws when the server returns a non-ok status', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('bad gateway', { status: 502 }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      createLlmChatResponse({
        baseUrl: 'https://llm.example.com',
        bearer: VALID_BEARER,
        model: 'gemma-4-e4b',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow(/LLM chat returned 502/);
  });

  it('throws when the server returns 401 (bad bearer)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      createLlmChatResponse({
        baseUrl: 'https://llm.example.com',
        bearer: VALID_BEARER,
        model: 'gemma-4-e4b',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow(/LLM chat returned 401/);
  });

  it('flattens newlines and truncates long upstream error bodies', async () => {
    const longBody = `${'<html>error\n'.repeat(50)}<details>internal-stack-trace</details>`;
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(longBody, { status: 500 }));
    vi.stubGlobal('fetch', mockFetch);

    let caught: unknown;
    try {
      await createLlmChatResponse({
        baseUrl: 'https://llm.example.com',
        bearer: VALID_BEARER,
        model: 'gemma-4-e4b',
        messages: [{ role: 'user', content: 'Hi' }],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    if (!(caught instanceof Error)) throw caught;
    expect(caught.message).toMatch(/^LLM chat returned 500: /);
    // No raw newlines leaked into the surfaced message
    expect(caught.message).not.toMatch(/\n/);
    // Total surfaced message stays bounded (status + 200 char body + ellipsis + prefix)
    expect(caught.message.length).toBeLessThan(260);
    expect(caught.message).toMatch(/…$/);
  });

  it('throws when the response has no body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      createLlmChatResponse({
        baseUrl: 'https://llm.example.com',
        bearer: VALID_BEARER,
        model: 'gemma-4-e4b',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow(/empty response body/i);
  });
});
