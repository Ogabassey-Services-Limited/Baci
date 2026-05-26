import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateQuizQuestionsWithGemma,
  QuizQuestionGenerationUnavailableError,
} from '@/lib/quiz/gemma-question-generator';

const mockGetLlmServerUrl = vi.fn();
const mockGetLlmServerBearer = vi.fn();
const mockGetLlmChatModel = vi.fn();

vi.mock('@/env', () => ({
  getLlmChatModel: () => mockGetLlmChatModel(),
  getLlmServerBearer: () => mockGetLlmServerBearer(),
  getLlmServerUrl: () => mockGetLlmServerUrl(),
}));

const VALID_BEARER = 'quiz-bearer-token';

describe('generateQuizQuestionsWithGemma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLlmServerUrl.mockReturnValue('https://llm.example.com/v1');
    mockGetLlmServerBearer.mockReturnValue(VALID_BEARER);
    mockGetLlmChatModel.mockReturnValue('gemma-4-e4b');
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
      model: 'gemma-4-e4b',
      response_format: { type: 'json_object' },
      stream: false,
      temperature: 0.35,
    });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('quiz question writer');
    expect(body.messages[1].content).toContain('Ogabassey');
    expect(body.messages[1].content).toContain('iPhone buying advice');
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
});
