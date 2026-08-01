import { describe, expect, it } from 'vitest';
import {
  manifest,
  seal,
  summarizeAtFixtureTime,
} from './storefront-origin-budget.test-fixtures';

describe('storefront origin budget alias host partition', () => {
  it('keeps alias totals outside the Worker decision reconciliation', () => {
    const evidence = manifest();
    evidence.days[0] = {
      ...evidence.days[0],
      workerInvocationCount: 10,
      totalDecisionCount: 10,
      edgeReleaseCount: 10,
      canonicalEligibleRequestCount: 10,
      aliasEligibleRequestCount: 20,
      aliasEdgeRedirectCount: 20,
      sourceEvidence: {
        ...evidence.days[0].sourceEvidence,
        aliasRedirect: {
          ...evidence.days[0].sourceEvidence.aliasRedirect,
          hostPartition:
            evidence.days[0].sourceEvidence.aliasRedirect.hostPartition.map(
              (row) => ({ ...row, requestCount: 10, eligibleRequestCount: 10 })
            ),
        },
      },
    };
    for (const day of evidence.days.slice(1)) {
      day.canonicalEligibleRequestCount = 0;
      day.aliasEligibleRequestCount = 0;
      day.workerInvocationCount = 0;
      day.totalDecisionCount = 0;
      day.edgeReleaseCount = 0;
    }
    const summary = summarizeAtFixtureTime(seal(evidence));
    expect(summary.allEligibleIngress).toBe(30);
    expect(summary.verdict).toBe('PASS');
  });

  it('does not pass when alias host raw request totals are omitted or double-counted', () => {
    for (const change of [
      (evidence: ReturnType<typeof manifest>) => {
        evidence.days[0].sourceEvidence.aliasRedirect.hostPartition.pop();
      },
      (evidence: ReturnType<typeof manifest>) => {
        evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[0] = {
          ...evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[0],
          requestCount: 1,
        };
      },
      (evidence: ReturnType<typeof manifest>) => {
        evidence.days[0].aliasEligibleRequestCount = 1;
        evidence.days[0].aliasEdgeRedirectCount = 1;
        evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[0] = {
          ...evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[0],
          requestCount: 1,
          eligibleRequestCount: 1,
        };
        evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[1] = {
          ...evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[1],
          requestCount: 1,
        };
      },
    ]) {
      const evidence = manifest();
      change(evidence);
      expect(summarizeAtFixtureTime(seal(evidence)).verdict).toBe('NOT_PROVEN');
    }
  });
});
