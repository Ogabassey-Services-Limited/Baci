import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOllamaChatResponse } from '@/lib/ollama-chat';

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe('createOllamaChatResponse', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams text chunks from Ollama chat responses', async () => {
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
      basicAuth: 'token',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(await response.text()).toBe('Hello there');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Basic token' }),
      })
    );
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body)).model).toBe(
      'gemma4:e4b'
    );
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

  it('surfaces invalid streaming JSON with chunk context', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(streamFromText('not-json\n')));
    vi.stubGlobal('fetch', mockFetch);

    const response = await createOllamaChatResponse({
      baseUrl: 'https://ollama.example.com',
      model: 'gemma4:e4b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    await expect(response.text()).rejects.toThrow(
      'Invalid Ollama chat chunk JSON'
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.anything()
    );
  });
});
