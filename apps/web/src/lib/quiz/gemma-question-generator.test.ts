import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateQuizQuestionsWithGemma,
  QuizQuestionGenerationUnavailableError,
} from '@/lib/quiz/gemma-question-generator';

const mockGetLlmServerUrl = vi.fn();
const mockGetLlmServerBearer = vi.fn();
const mockGetLlmChatModel = vi.fn();
const mockGetAiChatModel = vi.fn();
const mockGetOllamaBaseUrl = vi.fn();
const mockGetOllamaBasicAuth = vi.fn();

vi.mock('@/env', () => ({
  getAiChatModel: () => mockGetAiChatModel(),
  getLlmChatModel: () => mockGetLlmChatModel(),
  getLlmServerBearer: () => mockGetLlmServerBearer(),
  getLlmServerUrl: () => mockGetLlmServerUrl(),
  getOllamaBaseUrl: () => mockGetOllamaBaseUrl(),
  getOllamaBasicAuth: () => mockGetOllamaBasicAuth(),
}));

// The hosted Gemma chain (Cerebras Gemma 4 → Groq → Gemini → OpenRouter) is the
// PRIMARY provider. It is mocked here so these cases can exercise the
// self-hosted transport in isolation; hosted-first behaviour is asserted in its
// own block below, and the chain itself is covered by
// quiz-question-provider-chain.test.ts.
const mockHasHostedProvider = vi.hoisted(() => vi.fn());
const mockRunProviderChain = vi.hoisted(() => vi.fn());

vi.mock('@/lib/quiz/quiz-question-provider-chain', () => ({
  hasHostedQuizQuestionProvider: mockHasHostedProvider,
  runQuizQuestionProviderChain: mockRunProviderChain,
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const VALID_BEARER = 'quiz-bearer-token';

const QUIZ_JSON = JSON.stringify({
  questions: [
    {
      topic: 'Android buying advice',
      difficulty: 'standard',
      prompt: 'Which phone has the best battery?',
      options: [
        { id: 'a', label: 'Phone A' },
        { id: 'b', label: 'Phone B' },
      ],
      correctOptionId: 'a',
      explanation: 'Phone A has the larger cell.',
    },
  ],
});

describe('generateQuizQuestionsWithGemma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLlmServerUrl.mockReturnValue('https://llm.example.com/v1');
    mockGetLlmServerBearer.mockReturnValue(VALID_BEARER);
    mockGetLlmChatModel.mockReturnValue('gemma4:e4b');
    mockGetAiChatModel.mockReturnValue('gemma4:e2b');
    mockGetOllamaBaseUrl.mockReturnValue(undefined);
    mockGetOllamaBasicAuth.mockReturnValue(undefined);
    // Default for the self-hosted transport cases below.
    mockHasHostedProvider.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the VPS Gemma chat-completions endpoint for strict quiz JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    correctOptionId: 'b',
                    difficulty: 'standard',
                    explanation: 'USB-C arrived on the iPhone 15 family.',
                    options: [
                      { id: 'a', label: 'iPhone 13' },
                      { id: 'b', label: 'iPhone 15' },
                      { id: 'c', label: 'iPhone 12' },
                    ],
                    prompt: 'Which iPhone model introduced USB-C?',
                    topic: 'iPhone buying advice',
                  },
                ],
              }),
            },
          },
        ],
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const questions = await generateQuizQuestionsWithGemma({
      difficulty: 'standard',
      merchantName: 'Ogabassey',
      questionCountPerTopic: 1,
      topics: ['iPhone buying advice'],
    });

    expect(questions).toEqual([
      {
        correctOptionId: 'b',
        difficulty: 'standard',
        explanation: 'USB-C arrived on the iPhone 15 family.',
        options: [
          { id: 'a', label: 'iPhone 13' },
          { id: 'b', label: 'iPhone 15' },
          { id: 'c', label: 'iPhone 12' },
        ],
        prompt: 'Which iPhone model introduced USB-C?',
        topic: 'iPhone buying advice',
      },
    ]);
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

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      max_tokens: 2400,
      model: 'gemma4:e4b',
      response_format: { type: 'json_object' },
      stream: false,
      temperature: 0.35,
    });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('quiz question writer');
    expect(body.messages[0].content).toContain('Options must be objects');
    expect(body.messages[1].content).toContain('Ogabassey');
    expect(body.messages[1].content).toContain('iPhone buying advice');
    expect(body.messages[1].content).toContain('requiredJsonShape');
    expect(JSON.parse(body.messages[1].content)).not.toHaveProperty(
      'productContext'
    );
  });

  it('scales the completion token budget for larger quiz batches', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                questions: [
                  {
                    correctOptionId: 'a',
                    difficulty: 'hard',
                    explanation: 'OLED panels provide stronger contrast.',
                    options: [
                      { id: 'a', label: 'OLED display' },
                      { id: 'b', label: 'Plastic shell' },
                    ],
                    prompt: 'Which display technology improves contrast?',
                    topic: 'Phone displays',
                  },
                ],
              }),
            },
          },
        ],
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await generateQuizQuestionsWithGemma({
      difficulty: 'hard',
      merchantName: 'Ogabassey',
      questionCountPerTopic: 5,
      topics: [
        'Phone displays',
        'Battery health',
        'Camera lenses',
        'Charging ports',
        'Warranty checks',
        'Storage tiers',
        'Processor models',
        'Network bands',
        'Operating systems',
        'Accessory bundles',
      ],
    });

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body.max_tokens).toBe(8192);
  });

  it('fails closed before fetch when the Gemma VPS endpoint is not configured', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    mockGetLlmServerUrl.mockReturnValue(undefined);

    await expect(
      generateQuizQuestionsWithGemma({
        difficulty: 'standard',
        merchantName: 'Ogabassey',
        questionCountPerTopic: 1,
        topics: ['Android buying advice'],
      })
    ).rejects.toBeInstanceOf(QuizQuestionGenerationUnavailableError);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails closed before fetch when the Gemma bearer token is missing or invalid', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    mockGetLlmServerBearer.mockReturnValue('Bearer');

    await expect(
      generateQuizQuestionsWithGemma({
        difficulty: 'standard',
        merchantName: 'Ogabassey',
        questionCountPerTopic: 1,
        topics: ['Android buying advice'],
      })
    ).rejects.toBeInstanceOf(QuizQuestionGenerationUnavailableError);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces non-ok Gemma responses with the upstream status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({}, { status: 500 }))
    );

    await expect(
      generateQuizQuestionsWithGemma({
        difficulty: 'standard',
        merchantName: 'Ogabassey',
        questionCountPerTopic: 1,
        topics: ['Android buying advice'],
      })
    ).rejects.toThrow('Gemma quiz generation failed with 500');
  });

  it('rejects empty or invalid Gemma quiz JSON', async () => {
    const input = {
      difficulty: 'standard' as const,
      merchantName: 'Ogabassey',
      questionCountPerTopic: 1,
      topics: ['Android buying advice'],
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ choices: [{ message: { content: '' } }] })
        )
    );
    await expect(generateQuizQuestionsWithGemma(input)).rejects.toThrow(
      'Gemma returned an empty quiz generation response'
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      correctOptionId: 'z',
                      difficulty: 'standard',
                      explanation: 'Invalid answer key.',
                      options: [{ id: 'a', label: 'iPhone 15' }],
                      prompt: 'Which model supports USB-C?',
                      topic: 'iPhone buying advice',
                    },
                  ],
                }),
              },
            },
          ],
        })
      )
    );
    await expect(generateQuizQuestionsWithGemma(input)).rejects.toThrow(
      'Gemma returned invalid quiz question JSON'
    );
  });

  describe('hosted Gemma chain (Cerebras Gemma 4 first)', () => {
    const input = {
      difficulty: 'standard' as const,
      merchantName: 'Ogabassey',
      questionCountPerTopic: 1,
      topics: ['Android buying advice'],
    };

    beforeEach(() => {
      mockHasHostedProvider.mockReturnValue(true);
    });

    it('generates on the hosted chain and never touches the self-hosted server', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      mockRunProviderChain.mockImplementationOnce(
        ({ parseContent }: { parseContent: (content: string) => unknown }) =>
          Promise.resolve(parseContent(QUIZ_JSON))
      );

      const questions = await generateQuizQuestionsWithGemma(input);

      expect(questions).toHaveLength(1);
      expect(questions[0]?.prompt).toBe('Which phone has the best battery?');
      expect(mockRunProviderChain).toHaveBeenCalledTimes(1);
      expect(mockRunProviderChain).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('quiz question writer'),
          prompt: expect.stringContaining('Android buying advice'),
          temperature: 0.35,
          maxOutputTokens: expect.any(Number),
          abortSignal: expect.any(AbortSignal),
          parseContent: expect.any(Function),
        })
      );
      // The hosted chain succeeded, so the self-hosted VPS must not be called.
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not evaluate a broken self-hosted model before the hosted chain succeeds', async () => {
      mockGetLlmChatModel.mockImplementation(() => {
        throw new Error('invalid legacy LLM_CHAT_MODEL');
      });
      mockRunProviderChain.mockImplementationOnce(
        ({ parseContent }: { parseContent: (content: string) => unknown }) =>
          Promise.resolve(parseContent(QUIZ_JSON))
      );

      await expect(generateQuizQuestionsWithGemma(input)).resolves.toHaveLength(
        1
      );
      expect(mockGetLlmChatModel).not.toHaveBeenCalled();
    });

    it('falls back to the self-hosted Gemma server when the whole hosted chain fails', async () => {
      mockRunProviderChain.mockRejectedValue(new Error('all providers down'));
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: QUIZ_JSON } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const questions = await generateQuizQuestionsWithGemma(input);

      expect(questions).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(String(mockFetch.mock.calls[0]?.[0])).toContain('llm.example.com');
    });

    it('surfaces the hosted failure when there is no self-hosted server to fall back to', async () => {
      mockGetLlmServerUrl.mockReturnValue(undefined);
      mockGetOllamaBaseUrl.mockReturnValue(undefined);
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      mockRunProviderChain.mockRejectedValue(new Error('all providers down'));

      await expect(generateQuizQuestionsWithGemma(input)).rejects.toThrow(
        'all providers down'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails closed when NEITHER a hosted provider nor a self-hosted server is configured', async () => {
      mockHasHostedProvider.mockReturnValue(false);
      mockGetLlmServerUrl.mockReturnValue(undefined);
      mockGetOllamaBaseUrl.mockReturnValue(undefined);
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await expect(
        generateQuizQuestionsWithGemma(input)
      ).rejects.toBeInstanceOf(QuizQuestionGenerationUnavailableError);
      expect(mockRunProviderChain).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
