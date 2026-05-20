import { describe, expect, it } from '@jest/globals';
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
