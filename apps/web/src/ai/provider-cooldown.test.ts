import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearProviderCooldown,
  isProviderCoolingDown,
  isRateLimitError,
  recordProviderFailure,
  resetProviderCooldowns,
} from './provider-cooldown';

beforeEach(() => {
  resetProviderCooldowns();
});

describe('isRateLimitError', () => {
  it('recognizes an AI SDK error carrying HTTP 429', () => {
    const error = Object.assign(new Error('Upstream rejected'), {
      statusCode: 429,
    });

    expect(isRateLimitError(error)).toBe(true);
  });

  it.each([
    'Rate limit exceeded for gemma-4-31b',
    'rate_limit_exceeded',
    'Too Many Requests',
    'You exceeded your current quota',
  ])('recognizes rate limiting from the message %j', (message) => {
    expect(isRateLimitError(new Error(message))).toBe(true);
  });

  it('does not treat a 5xx or network failure as rate limiting', () => {
    expect(isRateLimitError(new Error('503 service unavailable'))).toBe(false);
    expect(isRateLimitError(new Error('fetch failed: ECONNRESET'))).toBe(false);
  });

  it('does not park on a bare "429" substring without a 429 status or rate-limit phrase', () => {
    // A real 429 carries statusCode 429 (handled above); the raw digits "429"
    // also appear in request ids / byte counts inside unrelated 5xx bodies, and
    // parking the chain's fastest link on those would violate the
    // only-park-on-rate-limits invariant.
    expect(
      isRateLimitError(new Error('500 internal error (trace 4290abf)'))
    ).toBe(false);
    expect(isRateLimitError(new Error('429'))).toBe(false);
  });
});

describe('recordProviderFailure', () => {
  it('parks a provider for the default window after a rate-limit rejection', () => {
    const now = 1_000_000;

    const cooldownMs = recordProviderFailure(
      'cerebras:gemma-4-31b',
      new Error('rate limit exceeded'),
      now
    );

    expect(cooldownMs).toBe(60_000);
    expect(isProviderCoolingDown('cerebras:gemma-4-31b', now + 59_000)).toBe(
      true
    );
  });

  it('honors the provider Retry-After header when present', () => {
    const now = 1_000_000;
    const error = Object.assign(new Error('rate limit'), {
      statusCode: 429,
      responseHeaders: { 'retry-after': '12' },
    });

    const cooldownMs = recordProviderFailure(
      'cerebras:gemma-4-31b',
      error,
      now
    );

    expect(cooldownMs).toBe(12_000);
    expect(isProviderCoolingDown('cerebras:gemma-4-31b', now + 11_000)).toBe(
      true
    );
    expect(isProviderCoolingDown('cerebras:gemma-4-31b', now + 13_000)).toBe(
      false
    );
  });

  it('honors the OpenAI-compatible x-ratelimit-reset-requests hint', () => {
    const now = 1_000_000;
    const error = Object.assign(new Error('rate limit'), {
      statusCode: 429,
      responseHeaders: { 'x-ratelimit-reset-requests': '2.5' },
    });

    expect(recordProviderFailure('groq:openai/gpt-oss-120b', error, now)).toBe(
      2500
    );
  });

  it('caps an absurd Retry-After at ten minutes', () => {
    const error = Object.assign(new Error('rate limit'), {
      statusCode: 429,
      responseHeaders: { 'retry-after': '86400' },
    });

    expect(recordProviderFailure('cerebras:gemma-4-31b', error, 0)).toBe(
      600_000
    );
  });

  it('does NOT park a provider that failed for a non-rate-limit reason', () => {
    const now = 1_000_000;

    const cooldownMs = recordProviderFailure(
      'cerebras:gemma-4-31b',
      new Error('503 upstream unavailable'),
      now
    );

    expect(cooldownMs).toBeNull();
    expect(isProviderCoolingDown('cerebras:gemma-4-31b', now)).toBe(false);
  });
});

describe('isProviderCoolingDown', () => {
  it('expires the cooldown once the window has passed', () => {
    const now = 1_000_000;
    recordProviderFailure(
      'cerebras:gemma-4-31b',
      Object.assign(new Error('rate limited'), { statusCode: 429 }),
      now
    );

    expect(isProviderCoolingDown('cerebras:gemma-4-31b', now)).toBe(true);
    expect(isProviderCoolingDown('cerebras:gemma-4-31b', now + 60_001)).toBe(
      false
    );
  });

  it('reports no cooldown for a provider that never failed', () => {
    expect(isProviderCoolingDown('google:gemini-2.5-flash')).toBe(false);
  });
});

describe('clearProviderCooldown', () => {
  it('un-parks a provider that has served successfully again', () => {
    const now = 1_000_000;
    recordProviderFailure(
      'cerebras:gemma-4-31b',
      Object.assign(new Error('rate limited'), { statusCode: 429 }),
      now
    );

    clearProviderCooldown('cerebras:gemma-4-31b');

    expect(isProviderCoolingDown('cerebras:gemma-4-31b', now)).toBe(false);
  });
});
