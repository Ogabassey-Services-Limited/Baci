import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlmChatResponse } from '@/lib/llm-chat';

const VALID_BEARER = 'a'.repeat(64);

describe('createLlmChatResponse errors', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it('maps timeouts when fetch rejects with signal.reason', async () => {
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

  it('throws when the server returns a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 }))
    );

    await expect(
      createLlmChatResponse({
        baseUrl: 'https://llm.example.com',
        bearer: VALID_BEARER,
        model: 'gemma-4-e4b',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow(/LLM chat returned 502/);
  });

  it('throws when the server returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    );

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(longBody, { status: 500 }))
    );

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
    expect(caught.message).not.toMatch(/\n/);
    expect(caught.message.length).toBeLessThan(260);
    expect(caught.message).toMatch(/…$/);
  });

  it('throws when the response has no body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )
    );

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
