import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateQuizQuestionsWithGemma } from '@/lib/quiz/gemma-question-generator';

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

describe('generateQuizQuestionsWithGemma Ollama fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLlmServerUrl.mockReturnValue('https://llm.example.com/v1');
    mockGetLlmServerBearer.mockReturnValue('quiz-bearer-token');
    mockGetLlmChatModel.mockReturnValue('gemma4:e4b');
    mockGetAiChatModel.mockReturnValue('gemma4:e2b');
    mockGetOllamaBaseUrl.mockReturnValue(undefined);
    mockGetOllamaBasicAuth.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes option strings and numeric answer ordinals', async () => {
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
                      correctOptionId: 2,
                      difficulty: 'standard',
                      explanation:
                        'Battery and ports are the functional checks.',
                      options: [
                        'Checking cosmetic condition',
                        'Testing battery health and ports',
                        'Checking the original box',
                        'Comparing online listings',
                      ],
                      prompt:
                        'When buying a used iPhone, what is the most important functional check?',
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

    const questions = await generateQuizQuestionsWithGemma({
      difficulty: 'standard',
      merchantName: 'Ogabassey',
      questionCountPerTopic: 1,
      topics: ['iPhone buying advice'],
    });

    expect(questions[0]).toMatchObject({
      correctOptionId: 'b',
      options: [
        { id: 'a', label: 'Checking cosmetic condition' },
        { id: 'b', label: 'Testing battery health and ports' },
        { id: 'c', label: 'Checking the original box' },
        { id: 'd', label: 'Comparing online listings' },
      ],
    });
  });

  it('falls back to the VPS Ollama Gemma endpoint when LLM server env is absent', async () => {
    mockGetLlmServerUrl.mockReturnValue(undefined);
    mockGetLlmServerBearer.mockReturnValue(undefined);
    mockGetOllamaBaseUrl.mockReturnValue('https://ollama.example.com/api');
    mockGetOllamaBasicAuth.mockReturnValue('user:password');
    const mockFetch = vi.fn().mockResolvedValue(
      Response.json({
        message: {
          content: JSON.stringify({
            questions: [
              {
                correctOptionId: 'a',
                difficulty: 'standard',
                explanation: 'USB-C supports newer charging accessories.',
                options: [
                  { id: 'a', label: 'USB-C' },
                  { id: 'b', label: 'Micro-USB' },
                ],
                prompt:
                  'Which charging port is common on newer Android phones?',
                topic: 'Android buying advice',
              },
            ],
          }),
        },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      generateQuizQuestionsWithGemma({
        difficulty: 'standard',
        merchantName: 'Ogabassey',
        questionCountPerTopic: 1,
        topics: ['Android buying advice'],
      })
    ).resolves.toMatchObject([
      {
        correctOptionId: 'a',
        prompt: 'Which charging port is common on newer Android phones?',
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ollama.example.com/api/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
        }),
      })
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      format: 'json',
      model: 'gemma4:e2b',
      options: {
        num_predict: 2400,
        temperature: 0.35,
      },
      stream: false,
      think: false,
    });
  });
});
