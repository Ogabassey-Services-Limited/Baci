import { describe, expect, it } from '@jest/globals';
import {
  buildQuizIntegrityToken,
  createPracticeSessionId,
  makePracticeSessionCounter,
} from './quiz-integrity';

describe('buildQuizIntegrityToken', () => {
  it('fails closed for prize attempts without a customer and fingerprint', () => {
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: 'event-1',
        customerId: null,
        fingerprint: null,
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
  });

  it('fails closed for partial prize integrity credentials', () => {
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: 'event-1',
        customerId: 'customer-1',
        fingerprint: null,
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: 'event-1',
        customerId: null,
        fingerprint: 'device-1',
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
  });

  it('fails closed for empty string prize integrity credentials', () => {
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: 'event-1',
        customerId: '',
        fingerprint: 'device-1',
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: 'event-1',
        customerId: 'customer-1',
        fingerprint: '',
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
  });

  it('fails closed for whitespace-only prize integrity credentials', () => {
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: 'event-1',
        customerId: '   ',
        fingerprint: 'device-1',
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: 'event-1',
        customerId: 'customer-1',
        fingerprint: '   ',
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
  });

  it('fails closed without an event id before constructing any token', () => {
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: '   ',
        customerId: 'customer-1',
        fingerprint: 'device-1',
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
    expect(
      buildQuizIntegrityToken({
        mode: 'practice',
        eventId: '',
        customerId: null,
        fingerprint: null,
      })
    ).toEqual({
      ok: false,
      reason: 'missing_prize_integrity',
    });
  });

  it('allows prize tokens only with customer and device integrity', () => {
    expect(
      buildQuizIntegrityToken({
        mode: 'prize',
        eventId: '  event:with:colon  ',
        customerId: '  customer-1  ',
        fingerprint: '  device-1  ',
      })
    ).toEqual({
      ok: true,
      prizeEligible: true,
      token: 'prize|event%3Awith%3Acolon|customer-1|device-1',
    });
  });

  it('allows controlled practice fallback without prize eligibility', () => {
    const result = buildQuizIntegrityToken({
      mode: 'practice',
      eventId: 'practice-1',
      customerId: null,
      fingerprint: null,
      practiceSessionId: 'practice-fixed',
    });

    expect(result).toMatchObject({
      ok: true,
      prizeEligible: false,
      token: expect.stringContaining('practice-1'),
    });
    if (!result.ok) {
      throw new Error('expected practice fallback token');
    }
    expect(result.token).toBe(
      'practice|practice-1|practice-customer-practice-fixed|practice-device-practice-fixed'
    );
  });

  it('creates injectable practice session ids for deterministic tests', () => {
    expect(
      createPracticeSessionId({
        now: () => 36,
        counter: () => 7,
      })
    ).toBe('practice-10-7');
  });

  it('increments generated practice session ids within the same timestamp', () => {
    const first = createPracticeSessionId({ now: () => 72 });
    const second = createPracticeSessionId({ now: () => 72 });

    expect(first).not.toBe(second);
    expect(first).toMatch(/^practice-20-[a-z0-9]+$/);
    expect(second).toMatch(/^practice-20-[a-z0-9]+$/);
  });

  it('creates isolated practice session counters for deterministic callers', () => {
    const firstCounter = makePracticeSessionCounter();
    const secondCounter = makePracticeSessionCounter();

    expect(firstCounter()).toBe(1);
    expect(firstCounter()).toBe(2);
    expect(secondCounter()).toBe(1);
  });
});
