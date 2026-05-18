import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFetch = jest.fn<typeof fetch>();
const mockGetSession = jest.fn(() =>
  Promise.resolve({ data: { session: { access_token: 'token-123' } } })
);
const mockGetUser = jest.fn(() =>
  Promise.resolve({ data: { user: { id: 'user-1' } } })
);

global.fetch = mockFetch;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  },
}));

const { startQuizAttempt, submitQuizAnswer } =
  require('./quiz-attempts') as typeof import('./quiz-attempts');

describe('quiz service attempt lifecycle', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('starts an attempt and submits answers through service contracts', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            attemptId: 'attempt-1',
            eventId: 'event-1',
            question: {
              id: 'question-1',
              prompt: 'What is 2 + 2?',
              options: [
                { id: 'a', label: '3' },
                { id: 'b', label: '4' },
              ],
              timeLimitSeconds: 30,
              index: 1,
              total: 1,
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            attemptId: 'attempt-1',
            status: 'completed',
            correctAnswers: 1,
            totalQuestions: 1,
            prizeEligible: true,
          }),
          { status: 200 }
        )
      );

    const attempt = await startQuizAttempt({
      baseUrl: 'https://example.com',
      eventId: 'event-1',
      integrityTier: 'basic',
    });
    const result = await submitQuizAnswer({
      answer: 'b',
      integrityTier: 'basic',
      baseUrl: 'https://example.com',
      attemptId: attempt.attemptId,
      questionId: attempt.question.id,
    });

    expect(attempt.question.prompt).toBe('What is 2 + 2?');
    expect(result).toMatchObject({ status: 'completed', prizeEligible: true });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://example.com/api/quiz/attempts/start',
      expect.objectContaining({
        body: JSON.stringify({ eventId: 'event-1', integrityTier: 'basic' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
        method: 'POST',
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://example.com/api/quiz/attempts/attempt-1/answers',
      expect.objectContaining({
        body: JSON.stringify({
          answer: 'b',
          integrityTier: 'basic',
          questionId: 'question-1',
        }),
        method: 'POST',
      })
    );
  });

  it('accepts an in-progress submit response with the next question', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          attemptId: 'attempt-1',
          status: 'in_progress',
          correctAnswers: 1,
          totalQuestions: 2,
          prizeEligible: false,
          question: {
            id: 'question-2',
            prompt: 'Next question?',
            options: [{ id: 'c', label: '5' }],
            timeLimitSeconds: 30,
            index: 2,
            total: 2,
          },
        }),
        { status: 200 }
      )
    );

    await expect(
      submitQuizAnswer({
        answer: 'b',
        integrityTier: 'strong',
        baseUrl: 'https://example.com',
        attemptId: 'attempt-1',
        questionId: 'question-1',
      })
    ).resolves.toMatchObject({
      status: 'in_progress',
      question: { id: 'question-2' },
    });
  });

  it('maps start and answer API error responses', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Event not found', code: 'QUIZ_NOT_FOUND' }),
          { status: 404 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Time expired', code: 'QUIZ_TIMEOUT' }),
          { status: 408 }
        )
      );

    await expect(
      startQuizAttempt({
        baseUrl: 'https://example.com',
        eventId: 'event-1',
        integrityTier: 'basic',
      })
    ).rejects.toMatchObject({
      code: 'QUIZ_NOT_FOUND',
      status: 404,
    });
    await expect(
      submitQuizAnswer({
        answer: 'b',
        baseUrl: 'https://example.com',
        attemptId: 'attempt-1',
        integrityTier: 'strong',
        questionId: 'question-1',
      })
    ).rejects.toMatchObject({
      code: 'QUIZ_TIMEOUT',
      status: 408,
    });
  });

  it('propagates start attempt network failures', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    await expect(
      startQuizAttempt({
        baseUrl: 'https://example.com',
        eventId: 'event-1',
        integrityTier: 'basic',
      })
    ).rejects.toThrow('network down');
  });

  it('maps submit answer API failures', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'QUIZ_FORBIDDEN', error: 'Forbidden' }),
        { status: 403 }
      )
    );

    await expect(
      submitQuizAnswer({
        answer: 'b',
        baseUrl: 'https://example.com',
        attemptId: 'attempt-1',
        integrityTier: 'strong',
        questionId: 'question-1',
      })
    ).rejects.toMatchObject({
      code: 'QUIZ_FORBIDDEN',
      message: 'Forbidden',
      status: 403,
    });
  });

  it('rejects invalid start attempt responses', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(new Response('{bad-json', { status: 200 }));

    await expect(
      startQuizAttempt({
        baseUrl: 'https://example.com',
        eventId: 'event-1',
        integrityTier: 'basic',
      })
    ).rejects.toMatchObject({
      code: 'QUIZ_INVALID_RESPONSE',
      status: 502,
    });
    warnSpy.mockRestore();
  });

  it('fails closed when the mobile bearer session is missing', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: '' } },
    });

    await expect(
      startQuizAttempt({
        baseUrl: 'https://example.com',
        eventId: 'event-1',
        integrityTier: 'basic',
      })
    ).rejects.toMatchObject({
      code: 'QUIZ_AUTH_REQUIRED',
      status: 401,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
