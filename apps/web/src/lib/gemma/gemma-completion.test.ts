import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestGemmaCompletion } from './gemma-completion';

describe('requestGemmaCompletion', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws an error if AI_CHAT_PROVIDER is gemini', async () => {
    await expect(
      requestGemmaCompletion({
        provider: 'gemini',
        llmServerUrl: 'https://llm.example.com',
        llmServerBearer: 'token123',
        model: 'gemma4:e2b',
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 100,
        temperature: 0.2,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow('gemini is not supported for this endpoint');
  });

  it('uses LLM when provider is auto and both are configured', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"status":"ok"}' } }],
      }),
    });

    const result = await requestGemmaCompletion({
      provider: 'auto',
      llmServerUrl: 'https://llm.example.com',
      llmServerBearer: 'token123',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4:e2b',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0.2,
      signal: new AbortController().signal,
    });

    expect(result).toBe('{"status":"ok"}');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://llm.example.com/v1/chat/completions'
    );
  });

  it('falls back to Ollama in auto mode when LLM auth config is partial', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: '{"status":"ollama"}' } }),
    });

    const result = await requestGemmaCompletion({
      provider: 'auto',
      llmServerUrl: 'https://llm.example.com',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4:e2b',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0.2,
      signal: new AbortController().signal,
    });

    expect(result).toBe('{"status":"ollama"}');
    expect(mockFetch.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat');
  });

  it('uses Ollama when provider is ollama even if LLM is configured', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: '{"status":"ok_ollama"}' } }),
    });

    const result = await requestGemmaCompletion({
      provider: 'ollama',
      llmServerUrl: 'https://llm.example.com',
      llmServerBearer: 'token123',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4:e2b',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0.2,
      signal: new AbortController().signal,
    });

    expect(result).toBe('{"status":"ok_ollama"}');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/chat');
  });

  it('uses LLM when provider is llm', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"status":"ok_llm"}' } }],
      }),
    });

    const result = await requestGemmaCompletion({
      provider: 'llm',
      llmServerUrl: 'https://llm.example.com',
      llmServerBearer: 'token123',
      model: 'gemma4:e2b',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0.2,
      signal: new AbortController().signal,
    });

    expect(result).toBe('{"status":"ok_llm"}');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://llm.example.com/v1/chat/completions'
    );
  });

  it('throws an error if missing LLM configuration', async () => {
    await expect(
      requestGemmaCompletion({
        provider: 'llm',
        model: 'gemma4:e2b',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 100,
        temperature: 0.2,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow('LLM configuration is missing');
  });

  it('throws an error if missing Ollama configuration', async () => {
    await expect(
      requestGemmaCompletion({
        provider: 'ollama',
        model: 'gemma4:e2b',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 100,
        temperature: 0.2,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow('Ollama configuration is missing');
  });

  it('throws on HTTP 500 from LLM server', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(
      requestGemmaCompletion({
        provider: 'llm',
        llmServerUrl: 'https://llm.example.com',
        llmServerBearer: 'token123',
        model: 'gemma4:e2b',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 100,
        temperature: 0.2,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow('Gemma completion failed with 500');
  });

  it('throws on HTTP 500 from Ollama server', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(
      requestGemmaCompletion({
        provider: 'ollama',
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        model: 'gemma4:e2b',
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 100,
        temperature: 0.2,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow('Gemma completion failed with 500');
  });

  it('sanitizes model names containing line breaks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await requestGemmaCompletion({
      provider: 'llm',
      llmServerUrl: 'https://llm.example.com',
      llmServerBearer: 'token123',
      model: 'gemma4:e2b\n\r',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0.2,
      signal: new AbortController().signal,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gemma4:e2b');
  });
});
