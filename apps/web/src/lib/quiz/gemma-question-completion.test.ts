import { describe, expect, it, vi } from 'vitest';
import { requestGemmaQuestionCompletion } from './gemma-question-completion';

const messages = [
  { role: 'system' as const, content: 'Return quiz JSON.' },
  { role: 'user' as const, content: '{"topics":["Phones"]}' },
];

describe('requestGemmaQuestionCompletion', () => {
  it('uses the OpenAI-compatible Gemma endpoint when it is configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"questions":[]}' } }],
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      requestGemmaQuestionCompletion({
        llmServerBearer: 'quiz-token',
        llmServerUrl: 'https://llm.example.com/v1',
        maxTokens: 2400,
        messages,
        model: 'gemma4:e4b',
        signal: new AbortController().signal,
        temperature: 0.35,
      })
    ).resolves.toBe('{"questions":[]}');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer quiz-token',
        }),
      })
    );
  });

  it('uses the VPS Ollama Gemma endpoint when the LLM endpoint is absent', async () => {
    const basicAuthCredential = ['user', 'password'].join(':');
    const expectedAuthHeader = `Basic ${Buffer.from(
      basicAuthCredential
    ).toString('base64')}`;
    const mockFetch = vi.fn().mockResolvedValue(
      Response.json({
        message: { content: '{"questions":[]}' },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      requestGemmaQuestionCompletion({
        maxTokens: 2400,
        messages,
        model: 'gemma4:e4b',
        ollamaBaseUrl: 'https://ollama.example.com/api',
        ollamaBasicAuth: basicAuthCredential,
        signal: new AbortController().signal,
        temperature: 0.35,
      })
    ).resolves.toBe('{"questions":[]}');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expectedAuthHeader,
        }),
      })
    );
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toMatchObject({
      format: 'json',
      model: 'gemma4:e4b',
      options: { num_predict: 2400, temperature: 0.35 },
      stream: false,
      think: false,
    });
  });
});
