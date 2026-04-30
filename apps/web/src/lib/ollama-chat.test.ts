import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';
import { createOllamaChatResponse } from '@/lib/ollama-chat';

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function getExpectedAuthorizationHeader(basicAuth: string): string {
  const authorization = buildOllamaBasicAuthHeader(basicAuth);
  if (!authorization) {
    throw new Error('Expected test Basic Auth value to produce a header');
  }
  return authorization;
}

describe('createOllamaChatResponse', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('streams text chunks from Ollama chat responses', async () => {
    const basicAuth = 'test-token';
    const expectedAuthorization = getExpectedAuthorizationHeader(basicAuth);
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          streamFromText(
            '{"message":{"content":"Hello"}}\n{"message":{"content":" there"}}\n'
          )
        )
      );
    vi.stubGlobal('fetch', mockFetch);

    const response = await createOllamaChatResponse({
      baseUrl: 'https://ollama.example.com/api/',
      model: 'gemma4:e4b\n',
      basicAuth,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('Hello there');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expectedAuthorization,
        }),
      })
    );
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body)).model).toBe(
      'gemma4:e4b'
    );
  });

  it('encodes raw Basic Auth credentials before sending them to Ollama', async () => {
    const rawCredentials = ['test-user', 'test-password'].join(':');
    const expectedAuthorization =
      getExpectedAuthorizationHeader(rawCredentials);
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(streamFromText('{"message":{"content":"ok"}}\n'))
      );
    vi.stubGlobal('fetch', mockFetch);

    const response = await createOllamaChatResponse({
      baseUrl: 'https://ollama.example.com',
      model: 'gemma4:e4b',
      basicAuth: rawCredentials,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('ok');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expectedAuthorization,
        }),
      })
    );
  });

  it('rejects malformed Basic Auth before calling Ollama', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      createOllamaChatResponse({
        baseUrl: 'https://ollama.example.com',
        model: 'gemma4:e4b',
        basicAuth: 'Basic   ',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow(
      'failed to build Basic Authorization header from basicAuth'
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses the full 120-second chat timeout by default', async () => {
    vi.useFakeTimers();
    let status: 'pending' | 'fulfilled' | 'rejected' = 'pending';
    let rejection: unknown;
    const mockFetch = vi.fn((_input: unknown, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true }
        );
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const request = createOllamaChatResponse({
      baseUrl: 'https://ollama.example.com',
      model: 'gemma4:e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    }).then(
      () => {
        status = 'fulfilled';
      },
      (error: unknown) => {
        status = 'rejected';
        rejection = error;
      }
    );

    await vi.advanceTimersByTimeAsync(119_999);
    expect(status).toBe('pending');

    await vi.advanceTimersByTimeAsync(1);
    await request;

    expect(status).toBe('rejected');
    expect(rejection).toBeInstanceOf(Error);
    if (!(rejection instanceof Error)) {
      throw new Error('Expected timeout rejection to be an Error');
    }
    expect(rejection.message).toBe('Ollama chat request timed out');
  });

  it('throws when Ollama returns a non-ok response', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('bad gateway', { status: 502 }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      createOllamaChatResponse({
        baseUrl: 'https://ollama.example.com',
        model: 'gemma4:e4b',
        messages: [{ role: 'user', content: 'Hi' }],
      })
    ).rejects.toThrow('Ollama chat returned 502');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.anything()
    );
  });

  it('surfaces invalid streaming JSON without leaking chunk content', async () => {
    expect.assertions(4);

    const malformedLine = '{"message":{"content":"customer phone secret"}';
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText(`${malformedLine}\n`)));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createOllamaChatResponse({
      baseUrl: 'https://ollama.example.com',
      model: 'gemma4:e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    try {
      await response.text();
      throw new Error('Expected malformed Ollama chunk to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);

      if (!(error instanceof Error)) {
        throw error;
      }

      expect(error.message).toContain('Invalid Ollama chat chunk JSON');
      expect(error.message).toContain(`payloadLength=${malformedLine.length}`);
      expect(error.message).not.toContain('customer phone secret');
    }
  });
});
