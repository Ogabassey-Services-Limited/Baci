import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiGet: apiGetMock,
  apiPost: apiPostMock,
}));

const EVENT = {
  endsAt: null,
  id: 'event-1',
  prizeName: 'iPhone 15 Pro Max',
  prizeProduct: {
    id: '11111111-1111-4111-8111-111111111111',
    imageUrl: 'https://cdn.example.com/iphone.png',
    name: 'iPhone 15 Pro Max',
    variantId: null,
  },
  questionCount: 1,
  startsAt: '2026-05-26T10:00:00.000Z',
  status: 'open',
  title: 'Daily Quiz',
};

const ATTEMPT = {
  attemptId: 'attempt-1',
  eventId: 'event-1',
  examPassPointsSpent: 0,
  remainingLoyaltyPoints: 5,
  question: {
    deadlineAt: '2026-07-14T09:00:30.000Z',
    id: 'q-1',
    index: 1,
    options: [{ id: 'a', label: '4' }],
    prompt: 'What is 2+2?',
    timeLimitSeconds: 30,
    total: 3,
  },
};

const RESULT = {
  attemptId: 'attempt-1',
  correctAnswers: 1,
  prizeEligible: false,
  status: 'completed',
  totalQuestions: 3,
};

describe('quiz-page-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchQuizEvents requests the events endpoint and returns parsed events', async () => {
    apiGetMock.mockResolvedValue({
      events: [EVENT],
      pagination: { hasMore: false, limit: 50, nextOffset: null, offset: 0 },
    });

    const { fetchQuizEvents } = await import('./quiz-page-data');
    const events = await fetchQuizEvents('ogabassey');

    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/quiz/events?')
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe('event-1');
  });

  it('fetchQuizEvents throws on an unparseable response', async () => {
    apiGetMock.mockResolvedValue({ nope: true });
    const { fetchQuizEvents } = await import('./quiz-page-data');

    await expect(fetchQuizEvents('ogabassey')).rejects.toThrow(
      'Invalid quiz response'
    );
  });

  it('startQuizAttempt posts the free-entry mode and returns the attempt', async () => {
    apiPostMock.mockResolvedValue(ATTEMPT);
    const { startQuizAttempt } = await import('./quiz-page-data');

    const attempt = await startQuizAttempt('event-1');

    expect(apiPostMock).toHaveBeenCalledWith(
      '/api/quiz/attempts/start',
      expect.objectContaining({ entryMode: 'free-v1', eventId: 'event-1' })
    );
    expect(attempt.attemptId).toBe('attempt-1');
  });

  it('submitQuizAnswer posts to the attempt answers endpoint', async () => {
    apiPostMock.mockResolvedValue(RESULT);
    const { submitQuizAnswer } = await import('./quiz-page-data');

    const result = await submitQuizAnswer('attempt-1', 'q-1', 'a');

    expect(apiPostMock).toHaveBeenCalledWith(
      '/api/quiz/attempts/attempt-1/answers',
      expect.objectContaining({ answer: 'a', questionId: 'q-1' })
    );
    expect(result.status).toBe('completed');
  });

  it('loadQuizEvents drives status to ready on success', async () => {
    apiGetMock.mockResolvedValue({
      events: [EVENT],
      pagination: { hasMore: false, limit: 50, nextOffset: null, offset: 0 },
    });
    const setError = vi.fn();
    const setEvents = vi.fn();
    const setStatus = vi.fn();

    const { loadQuizEvents } = await import('./quiz-page-data');
    await loadQuizEvents('ogabassey', { setError, setEvents, setStatus });

    expect(setStatus).toHaveBeenCalledWith('loading');
    expect(setEvents).toHaveBeenCalledWith([expect.objectContaining({ id: 'event-1' })]);
    expect(setStatus).toHaveBeenLastCalledWith('ready');
  });

  it('loadQuizEvents drives status to error and surfaces a message on failure', async () => {
    apiGetMock.mockRejectedValue(new Error('network down'));
    const setError = vi.fn();
    const setEvents = vi.fn();
    const setStatus = vi.fn();

    const { loadQuizEvents } = await import('./quiz-page-data');
    await loadQuizEvents('ogabassey', { setError, setEvents, setStatus });

    expect(setStatus).toHaveBeenLastCalledWith('error');
    expect(setError).toHaveBeenCalledWith(expect.any(String));
    expect(setEvents).not.toHaveBeenCalled();
  });
});
