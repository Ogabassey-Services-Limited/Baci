import { afterEach, describe, expect, it, vi } from 'vitest';

describe('quiz compliance gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('defaults missing quiz phase to 1a and rejects invalid phases', async () => {
    const { getQuizPhase } = await import('@/lib/quiz-compliance-gate');

    expect(getQuizPhase(undefined)).toBe('1a');
    expect(getQuizPhase('1a')).toBe('1a');
    expect(getQuizPhase('1A')).toBe('1a');
    expect(getQuizPhase('production')).toBe('production');
    expect(getQuizPhase('PRODUCTION')).toBe('production');
    expect(() => getQuizPhase('staging')).toThrow(
      'Invalid quiz phase configuration.'
    );
  });

  it('blocks prize flow in Phase 1a even when approval is truthy', async () => {
    vi.stubEnv('QUIZ_PHASE', '1a');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard({ nlrc_permit_ref: 'NLRC-123' }, true)
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow when approval is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard({ nlrc_permit_ref: 'NLRC-123' }, true)
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow when permit evidence is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard({ nlrc_permit_ref: '   ' }, true)
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow when compliance evidence is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard({ nlrc_permit_ref: 'NLRC-123' }, false)
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('allows production prize flow when approval, permit, and compliance evidence are all present', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard({ nlrc_permit_ref: 'NLRC-123' }, true)
    ).not.toThrow();
  });
});
