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
const mockHasHostedProvider = vi.hoisted(() => vi.fn());
const mockRunProviderChain = vi.hoisted(() => vi.fn());

vi.mock('@/env', () => ({
  getAiChatModel: () => mockGetAiChatModel(),
  getLlmChatModel: () => mockGetLlmChatModel(),
  getLlmServerBearer: () => mockGetLlmServerBearer(),
  getLlmServerUrl: () => mockGetLlmServerUrl(),
  getOllamaBaseUrl: () => mockGetOllamaBaseUrl(),
  getOllamaBasicAuth: () => mockGetOllamaBasicAuth(),
}));

vi.mock('@/lib/quiz/quiz-question-provider-chain', () => ({
  createHostedQuizQuestionProviderSignal: (routeSignal: AbortSignal) =>
    AbortSignal.any([routeSignal, AbortSignal.timeout(60_000)]),
  hasHostedQuizQuestionProvider: mockHasHostedProvider,
  runQuizQuestionProviderChain: mockRunProviderChain,
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

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

const input = {
  difficulty: 'standard' as const,
  merchantName: 'Ogabassey',
  questionCountPerTopic: 1,
  topics: ['Android buying advice'],
};

describe('hosted Gemma quiz question generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLlmServerUrl.mockReturnValue('https://llm.example.com/v1');
    mockGetLlmServerBearer.mockReturnValue('quiz-bearer-token');
    mockGetLlmChatModel.mockReturnValue('gemma4:e4b');
    mockGetAiChatModel.mockReturnValue('gemma4:e2b');
    mockGetOllamaBaseUrl.mockReturnValue(undefined);
    mockGetOllamaBasicAuth.mockReturnValue(undefined);
    mockHasHostedProvider.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    expect(mockRunProviderChain).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: expect.any(AbortSignal),
        maxOutputTokens: expect.any(Number),
        parseContent: expect.any(Function),
        prompt: expect.stringContaining('Android buying advice'),
        system: expect.stringContaining('quiz question writer'),
        temperature: 0.35,
      })
    );
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

  it('reserves route time for the self-hosted fallback', async () => {
    const hostedController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(hostedController.signal);
    mockRunProviderChain.mockImplementationOnce(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener('abort', () => {
            reject(new DOMException('hosted deadline', 'TimeoutError'));
          });
          hostedController.abort();
        })
    );
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: QUIZ_JSON } }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(generateQuizQuestionsWithGemma(input)).resolves.toHaveLength(
      1
    );
    expect(timeoutSpy).toHaveBeenCalledWith(60_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back when the whole hosted chain fails', async () => {
    mockRunProviderChain.mockRejectedValue(new Error('all providers down'));
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: QUIZ_JSON } }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(generateQuizQuestionsWithGemma(input)).resolves.toHaveLength(
      1
    );
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('llm.example.com');
  });

  it('surfaces hosted failure when no self-hosted server is configured', async () => {
    mockGetLlmServerUrl.mockReturnValue(undefined);
    mockGetOllamaBaseUrl.mockReturnValue(undefined);
    mockRunProviderChain.mockRejectedValue(new Error('all providers down'));

    await expect(generateQuizQuestionsWithGemma(input)).rejects.toThrow(
      'all providers down'
    );
  });

  it('fails closed when no provider is configured', async () => {
    mockHasHostedProvider.mockReturnValue(false);
    mockGetLlmServerUrl.mockReturnValue(undefined);
    mockGetOllamaBaseUrl.mockReturnValue(undefined);

    await expect(generateQuizQuestionsWithGemma(input)).rejects.toBeInstanceOf(
      QuizQuestionGenerationUnavailableError
    );
    expect(mockRunProviderChain).not.toHaveBeenCalled();
  });
});
