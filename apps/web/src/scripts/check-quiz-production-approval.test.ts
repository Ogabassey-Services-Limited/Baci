import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { evaluateQuizProductionApproval } from '@/scripts/check-quiz-production-approval';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('evaluateQuizProductionApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows Phase 1a without production approval evidence', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: '1a',
      quizProductionApproved: false,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [],
      trackerRows: [],
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('1a');
  });

  it('fails Phase 1a when the DB-side proof secret is not configured', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: '1a',
      quizProductionApproved: false,
      quizRpcServerSecretConfigured: false,
      quizRpcServerSecretMatches: false,
      events: [],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Postgres setting app.quiz_rpc_server_secret_current must be configured for quiz route proof verification'
    );
  });

  it('fails production mode when approval is not truthy', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: false,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'QUIZ_PRODUCTION_APPROVED must be truthy for production prize runtime'
    );
  });

  it('fails with invalid mode when quiz phase is not recognized', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'staging',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [],
      trackerRows: [],
    });

    expect(result).toEqual({
      errors: ['QUIZ_PHASE must be 1a or production'],
      mode: 'invalid',
      ok: false,
    });
  });

  it('fails production mode when the DB-side proof secret is not configured', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: false,
      quizRpcServerSecretMatches: false,
      events: [],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Postgres setting app.quiz_rpc_server_secret_current must be configured for quiz route proof verification'
    );
  });

  it('fails Phase 1a when the env secret does not match the database secret', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: '1a',
      quizProductionApproved: false,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: false,
      events: [],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'QUIZ_RPC_SERVER_SECRET does not match the database quiz route-proof secret (proof signature verification would fail at runtime)'
    );
  });

  it('fails production mode when the env secret does not match the database secret', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: false,
      events: [],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'QUIZ_RPC_SERVER_SECRET does not match the database quiz route-proof secret (proof signature verification would fail at runtime)'
    );
  });

  it('reports only the not-configured error when the secret is absent (no duplicate mismatch error)', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: false,
      quizRpcServerSecretMatches: false,
      events: [],
      trackerRows: [],
    });

    const secretErrors = result.errors.filter((error) =>
      error.includes('quiz_rpc_server_secret_current')
    );
    expect(secretErrors).toHaveLength(1);
    expect(result.errors).not.toContain(
      'QUIZ_RPC_SERVER_SECRET does not match the database quiz route-proof secret (proof signature verification would fail at runtime)'
    );
  });

  it('fails production mode when active prize events lack compliance or odds evidence', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [
        {
          compliance_verified: true,
          id: 'event-1',
          regulatory_basis: null,
          regulatory_evidence_ref: null,
          regulatory_jurisdiction: null,
          status: 'active',
          published_odds: null,
        },
      ],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Quiz event event-1 is missing a supported regulatory_basis, regulatory_jurisdiction, or regulatory_evidence_ref',
        'Quiz event event-1 is missing published_odds',
      ])
    );
  });

  it('fails production mode when active prize events are not compliance verified', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [
        {
          compliance_verified: false,
          id: 'event-1',
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
          status: 'active',
          published_odds: { tiers: [{ rank: 1, odds: '1/1000' }] },
        },
      ],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      'Quiz event event-1 is not compliance_verified',
    ]);
  });

  it('ignores non-active events when checking production prize evidence', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [
        {
          compliance_verified: false,
          id: 'event-draft',
          regulatory_basis: null,
          regulatory_evidence_ref: null,
          regulatory_jurisdiction: null,
          status: 'draft',
          published_odds: null,
        },
      ],
      trackerRows: [
        {
          item: 'NLRC permit',
          verification_status: 'verified',
          approved_at: '2026-05-16T09:00:00Z',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails production mode when tracker rows are unverified or unapproved', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [],
      trackerRows: [
        {
          item: 'NLRC permit',
          verification_status: 'in_review',
          approved_at: null,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Compliance tracker NLRC permit is not verified',
        'Compliance tracker NLRC permit is missing approved_at',
      ])
    );
  });

  it('fails production mode when unresolved research placeholders remain', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [
        {
          compliance_verified: true,
          id: 'event-2',
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
          status: 'active',
          published_odds: { note: 'TBD_COUNSEL_CONFIRMED_RATE' },
        },
      ],
      trackerRows: [
        {
          item: 'WHT',
          verification_status: 'verified',
          approved_at: '2026-05-16T09:00:00Z',
          approval_comment: 'UNVERIFIED research note',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Quiz event event-2 contains unresolved compliance placeholders',
        'Compliance tracker WHT contains unresolved compliance placeholders',
      ])
    );
  });

  it('logs and returns a validation error when compliance marker values cannot be stringified', () => {
    const circularOdds: Record<string, unknown> = { tiers: [] };
    circularOdds.self = circularOdds;

    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [
        {
          compliance_verified: true,
          id: 'event-circular',
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
          status: 'active',
          published_odds: circularOdds,
        },
      ],
      trackerRows: [
        {
          item: 'NLRC permit',
          verification_status: 'verified',
          approved_at: '2026-05-16T09:00:00Z',
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Quiz event event-circular could not be checked against UNRESOLVED_MARKER_PATTERN'
        ),
      ])
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        constantName: 'UNRESOLVED_MARKER_PATTERN',
        functionName: 'containsUnresolvedComplianceMarker',
        markerPattern: '/UNVERIFIED|TBD_COUNSEL_CONFIRMED_/',
        message: 'Unable to stringify quiz compliance marker value',
        valueType: 'object',
      })
    );
  });

  it('passes production mode for a verified free skill competition without an NLRC reference', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      quizRpcServerSecretConfigured: true,
      quizRpcServerSecretMatches: true,
      events: [
        {
          compliance_verified: true,
          id: 'event-3',
          regulatory_basis: 'free_skill_competition',
          regulatory_evidence_ref: 'COUNSEL-2026-08-05',
          regulatory_jurisdiction: 'NG-LA',
          status: 'active',
          published_odds: { tiers: [{ rank: 1, odds: '1/1000' }] },
        },
      ],
      trackerRows: [
        {
          item: 'Free skill counsel opinion',
          verification_status: 'verified',
          approved_at: '2026-05-16T09:00:00Z',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
