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
      events: [],
      trackerRows: [],
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('1a');
  });

  it('fails production mode when approval is not truthy', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: false,
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
      events: [],
      trackerRows: [],
    });

    expect(result).toEqual({
      errors: ['QUIZ_PHASE must be 1a or production'],
      mode: 'invalid',
      ok: false,
    });
  });

  it('fails production mode when active prize events lack permit or odds evidence', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      events: [
        {
          id: 'event-1',
          status: 'active',
          nlrc_permit_ref: '',
          published_odds: null,
          compliance_flags: {},
        },
      ],
      trackerRows: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Quiz event event-1 is missing nlrc_permit_ref',
        'Quiz event event-1 is missing published_odds',
      ])
    );
  });

  it('ignores non-active events when checking production prize evidence', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      events: [
        {
          id: 'event-draft',
          status: 'draft',
          nlrc_permit_ref: null,
          published_odds: null,
          compliance_flags: {},
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
      events: [
        {
          id: 'event-2',
          status: 'active',
          nlrc_permit_ref: 'NLRC-123',
          published_odds: { note: 'TBD_COUNSEL_CONFIRMED_RATE' },
          compliance_flags: {},
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
      events: [
        {
          id: 'event-circular',
          status: 'active',
          nlrc_permit_ref: 'NLRC-123',
          published_odds: circularOdds,
          compliance_flags: {},
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

  it('passes production mode when events and compliance tracker are verified', () => {
    const result = evaluateQuizProductionApproval({
      quizPhase: 'production',
      quizProductionApproved: true,
      events: [
        {
          id: 'event-3',
          status: 'active',
          nlrc_permit_ref: 'NLRC-123',
          published_odds: { tiers: [{ rank: 1, odds: '1/1000' }] },
          compliance_flags: { baseline_v2_signed: true },
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
});
