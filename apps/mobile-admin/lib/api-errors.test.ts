import { describe, expect, it } from 'vitest';
import { getResponseErrorMessage, NetworkError } from './api-errors';

describe('api errors', () => {
  it('preserves NetworkError metadata', () => {
    const error = new NetworkError('Timed out', {
      data: { code: 'timeout' },
      isTimeout: true,
      statusCode: 504,
    });

    expect(error.name).toBe('NetworkError');
    expect(error.isTimeout).toBe(true);
    expect(error.statusCode).toBe(504);
    expect(error.data).toEqual({ code: 'timeout' });
  });

  it('extracts response error messages by priority', () => {
    expect(getResponseErrorMessage('Plain error', 400)).toBe('Plain error');
    expect(getResponseErrorMessage({ message: 'Message field' }, 400)).toBe(
      'Message field'
    );
    expect(getResponseErrorMessage({ error: 'Error field' }, 400)).toBe(
      'Error field'
    );
    expect(getResponseErrorMessage({}, 500)).toBe(
      'Request failed with status 500'
    );
  });
});
