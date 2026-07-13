import { describe, expect, it } from 'vitest';
import { isDefinitivePetrockSubmissionRejection } from './petrock-submission-outcome';

describe('isDefinitivePetrockSubmissionRejection', () => {
  it('accepts only explicit HTTP 4xx submission rejections', () => {
    expect(
      isDefinitivePetrockSubmissionRejection({
        kind: 'http',
        message: 'invalid input',
        ok: false,
        status: 400,
      })
    ).toBe(true);
    expect(
      isDefinitivePetrockSubmissionRejection({
        kind: 'http',
        message: 'server error',
        ok: false,
        status: 500,
      })
    ).toBe(false);
    expect(
      isDefinitivePetrockSubmissionRejection({
        kind: 'timeout',
        message: 'timeout',
        ok: false,
      })
    ).toBe(false);
  });

  it.each([
    408, 425, 429,
  ])('treats transient HTTP %i responses as ambiguous', (status) => {
    expect(
      isDefinitivePetrockSubmissionRejection({
        kind: 'http',
        message: 'try again',
        ok: false,
        status,
      })
    ).toBe(false);
  });
});
