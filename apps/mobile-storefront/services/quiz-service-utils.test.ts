import {
  getOptionalString,
  getQuizErrorCode,
  getQuizErrorMessage,
  getSafeErrorMessage,
  readQuizJson,
} from './quiz-service-utils';

describe('quiz service utils', () => {
  it('normalizes optional strings', () => {
    expect(getOptionalString(' merchant ')).toBe('merchant');
    expect(getOptionalString('   ')).toBeUndefined();
    expect(getOptionalString(null)).toBeUndefined();
  });

  it('reads safe error messages from common error shapes', () => {
    expect(getSafeErrorMessage(new Error('network down'))).toBe('network down');
    expect(getSafeErrorMessage({ message: 'jwt expired' })).toBe('jwt expired');
    expect(getSafeErrorMessage({ code: 'QZ004' })).toBe('{"code":"QZ004"}');
    expect(getSafeErrorMessage('fallback')).toBe('fallback');
  });

  it('returns a safe placeholder for circular error objects', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(getSafeErrorMessage(circular)).toBe('Unserializable error object');
  });

  it('maps quiz API error payloads', () => {
    expect(getQuizErrorMessage({ error: 'Quiz closed' })).toBe('Quiz closed');
    expect(getQuizErrorMessage({ error: 123 })).toBe('Quiz request failed');
    expect(getQuizErrorCode({ code: 'QUIZ_CLOSED' })).toBe('QUIZ_CLOSED');
    expect(getQuizErrorCode({ code: null })).toBe('QUIZ_REQUEST_FAILED');
  });

  it('returns null when the quiz response JSON cannot be parsed', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await expect(
        readQuizJson(new Response('not json', { status: 502 }))
      ).resolves.toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        'Unable to parse quiz API JSON response',
        expect.objectContaining({ status: 502 })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
