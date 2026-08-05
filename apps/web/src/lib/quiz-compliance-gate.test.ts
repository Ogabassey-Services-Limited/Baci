import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

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
      enforcePrizeProductionGuard(
        {
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
        },
        true
      )
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow when approval is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard(
        {
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
        },
        true
      )
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow when the compliance evidence reference is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard(
        {
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: '   ',
          regulatory_jurisdiction: 'NG-LA',
        },
        true
      )
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow for an unsupported regulatory basis', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard(
        {
          regulatory_basis: 'national_permit',
          regulatory_evidence_ref: 'NOT-ACCEPTED',
          regulatory_jurisdiction: 'NG-LA',
        },
        true
      )
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow when the covered jurisdiction is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard(
        {
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: ' ',
        },
        true
      )
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it('blocks production prize flow when compliance evidence is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard(
        {
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
        },
        false
      )
    ).toThrow('Quiz production is not approved for prize claims.');
  });

  it.each([
    'free_skill_competition',
    'state_permit',
    'fccpc_registration',
  ] as const)('allows %s when approval and compliance evidence are all present', async (basis) => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { enforcePrizeProductionGuard } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      enforcePrizeProductionGuard(
        {
          regulatory_basis: basis,
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
        },
        true
      )
    ).not.toThrow();
  });

  it('does not allow a deprecated NLRC reference to satisfy the new guard alone', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { getQuizComplianceEvidence } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(
      getQuizComplianceEvidence({ nlrc_permit_ref: 'LEGACY-STATE-123' })
    ).toBeNull();
  });
});

describe('quiz deployment phase assertion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats VERCEL_ENV=production (or NODE_ENV fallback) as a production deployment', async () => {
    const { isQuizProductionDeployment } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(isQuizProductionDeployment({ vercelEnv: 'production' })).toBe(true);
    expect(isQuizProductionDeployment({ vercelEnv: 'preview' })).toBe(false);
    expect(
      isQuizProductionDeployment({ vercelEnv: '', nodeEnv: 'production' })
    ).toBe(true);
    expect(isQuizProductionDeployment({ nodeEnv: 'test' })).toBe(false);
  });

  it('fails loud and closed when a production deployment runs an unset (1a) phase', async () => {
    const errorSpy = vi
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    const { assertQuizPhaseMatchesDeployment } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      assertQuizPhaseMatchesDeployment('1a', { vercelEnv: 'production' })
    ).toThrow(
      'QUIZ_PHASE must be set to "production" in a production deployment that awards prizes.'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('QUIZ_PHASE is not "production"'),
        quizPhase: '1a',
        vercelEnv: 'production',
      })
    );
  });

  it('passes when a production deployment is correctly set to the production phase', async () => {
    const { assertQuizPhaseMatchesDeployment } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      assertQuizPhaseMatchesDeployment('production', {
        vercelEnv: 'production',
      })
    ).not.toThrow();
  });

  it('passes outside production deployments even when the phase is unset', async () => {
    const { assertQuizPhaseMatchesDeployment } = await import(
      '@/lib/quiz-compliance-gate'
    );

    expect(() =>
      assertQuizPhaseMatchesDeployment('1a', { vercelEnv: 'preview' })
    ).not.toThrow();
  });
});
