import { describe, expect, it } from 'vitest';
import {
  manifest,
  seal,
  setTrafficPartitionCounts,
  summarizeAtFixtureTime,
} from './storefront-origin-budget.test-fixtures';

describe('storefront origin budget alias host partition', () => {
  it('includes canonical pre-Worker WAF rejects in the raw host census', () => {
    const evidence = manifest();
    const day = evidence.days[0];
    day.rejectedMethodRequestCount = 1;
    day.sourceEvidence.wafRateLimit.rejectedMethodRequestCount = 1;
    day.trafficPartition.push({
      hostname: 'ogabassey.com',
      methodClass: 'OTHER',
      pathClass: 'mutation',
      ruleId: 'waf-invalid-method',
      requestCount: 1,
      eligibleRequestCount: 0,
      eligibleOriginAttemptCount: 0,
      rejectedMethodRequestCount: 1,
    });
    expect(summarizeAtFixtureTime(seal(evidence))).toMatchObject({
      trafficPartitionReconciled: true,
      verdict: 'PASS',
    });
    day.trafficPartition.pop();
    expect(summarizeAtFixtureTime(seal(evidence)).verdict).toBe('NOT_PROVEN');
  });

  it('reconciles full alias raw traffic separately from static redirects', () => {
    const evidence = manifest();
    evidence.days[0] = {
      ...evidence.days[0],
      workerInvocationCount: 10,
      totalDecisionCount: 10,
      edgeReleaseCount: 10,
      canonicalEligibleRequestCount: 10,
      aliasEligibleRequestCount: 20,
      aliasEdgeRedirectCount: 20,
      aliasRawRequestCount: 21,
      sourceEvidence: {
        ...evidence.days[0].sourceEvidence,
        invocation: {
          ...evidence.days[0].sourceEvidence.invocation,
          requestCount: 10,
        },
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
      day.sourceEvidence.invocation.requestCount = 0;
      day.totalDecisionCount = 0;
      day.edgeReleaseCount = 0;
      setTrafficPartitionCounts(day, {
        canonicalRawRequestCount: 0,
        canonicalEligibleRequestCount: 0,
      });
    }
    setTrafficPartitionCounts(evidence.days[0], {
      canonicalRawRequestCount: 10,
      canonicalEligibleRequestCount: 10,
      aliasEligibleRequestCount: 20,
    });
    const aliasStaticRow = evidence.days[0].trafficPartition.find(
      (row) => row.hostname === 'ogabassey.usebaci.com'
    );
    if (!aliasStaticRow) throw new Error('alias fixture row is missing');
    aliasStaticRow.requestCount = 20;
    evidence.days[0].trafficPartition.push({
      ...aliasStaticRow,
      methodClass: 'POST',
      pathClass: 'api',
      ruleId: 'alias-api',
      requestCount: 1,
      eligibleRequestCount: 0,
      eligibleOriginAttemptCount: 0,
      rejectedMethodRequestCount: 0,
    });
    evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[0] = {
      ...evidence.days[0].sourceEvidence.aliasRedirect.hostPartition[0],
      requestCount: 11,
    };
    const summary = summarizeAtFixtureTime(seal(evidence));
    expect(summary.allEligibleIngress).toBe(30);
    expect(summary.trafficPartitionReconciled).toBe(true);
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
