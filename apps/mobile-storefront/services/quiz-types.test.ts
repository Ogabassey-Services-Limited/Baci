import { describe, expect, it } from '@jest/globals';
import type {
  QuizActiveAttemptResponse,
  QuizEvent,
  QuizV2Result,
} from './quiz-types';
import { QuizServiceError } from './quiz-types';

describe('QuizServiceError', () => {
  it('preserves error metadata and prototype inheritance', () => {
    const error = new QuizServiceError('msg', 'ERR_CODE', 400);

    expect(error).toBeInstanceOf(QuizServiceError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('msg');
    expect(error.name).toBe('QuizServiceError');
    expect(error.code).toBe('ERR_CODE');
    expect(error.status).toBe(400);
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('QuizServiceError');
    expect(error.stack?.length).toBeGreaterThan(0);
  });

  it.each([
    { code: 'ERR_AUTH', message: 'Unauthorized', status: 401 },
    { code: 'ERR_NOT_FOUND', message: 'Quiz not found', status: 404 },
    { code: 'ERR_SERVER', message: 'Server failed', status: 500 },
  ])('preserves $code and $status metadata', ({ code, message, status }) => {
    const error = new QuizServiceError(message, code, status);

    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
    expect(error).toBeInstanceOf(Error);
  });

  it.each([
    '',
    'Symbols !@#$%^&*() and currency NGN',
    'x'.repeat(2048),
  ])('preserves edge-case messages', (message) => {
    const error = new QuizServiceError(message, 'ERR_EDGE', 418);

    expect(error.message).toBe(message);
    expect(error.code).toBe('ERR_EDGE');
    expect(error.status).toBe(418);
    expect(typeof error.stack).toBe('string');
  });
});

describe('quiz v2 mobile types', () => {
  it('represents full prize, timing, recovery, and pending result states', () => {
    const event: QuizEvent = {
      contractVersion: 2,
      endsAt: '2026-08-04T12:05:00.000Z',
      id: 'event-1',
      mode: 'test',
      prizeName: 'iPhone XR',
      prizeProduct: {
        condition: 'used',
        id: 'product-1',
        imageUrl: 'https://cdn.example.com/iphone.png',
        name: 'iPhone XR',
        variantId: null,
      },
      questionCount: 20,
      startsAt: '2026-08-04T12:00:00.000Z',
      status: 'active',
      title: 'Redmi Warriors',
    };
    const recovery: QuizActiveAttemptResponse = {
      availability: 'pending_results',
      eventEndsAt: event.endsAt,
      serverNow: event.endsAt ?? '',
    };
    const result: QuizV2Result = {
      attemptId: 'attempt-1',
      availability: 'pending',
      availableAt: null,
    };

    expect(event.prizeProduct?.imageUrl).toContain('iphone.png');
    expect(recovery.availability).toBe('pending_results');
    expect(result.availability).toBe('pending');
  });
});
