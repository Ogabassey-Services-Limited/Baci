import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';
import {
  current,
  currentWithWorkersLogsContract,
} from './ogabassey-current-origin-baseline.test-fixtures';
import { reconcileOgabasseyBaselineHostEvidence } from './ogabassey-current-origin-baseline-traffic';

const now = new Date('2026-08-01T12:00:00.000Z');

describe('Ogabassey baseline host traffic reconciliation', () => {
  it('reconciles every discovered hostname and returns static/dynamic projections', () => {
    const result = reconcileOgabasseyBaselineHostEvidence(
      current.hostEvidence,
      current.discoveredHostnames,
      current.allIngressRequests,
      current.allIngressOriginAttempts
    );

    expect(result).toEqual({
      ok: true,
      projection: {
        eligibleStaticRequests: 1_000,
        eligibleStaticOriginAttempts: 20,
        dynamicRequests: 0,
        dynamicOriginAttempts: 0,
      },
    });
  });

  it('rejects a discovered hostname whose totals are omitted from the rows', () => {
    const discoveredHostnames = [
      ...current.discoveredHostnames,
      'shop.ogabassey.com',
    ];
    const result = reconcileOgabasseyBaselineHostEvidence(
      current.hostEvidence,
      discoveredHostnames,
      current.allIngressRequests,
      current.allIngressOriginAttempts
    );

    expect(result).toEqual({
      ok: false,
      reason: 'host_traffic_evidence_invalid',
    });
  });

  it('rejects host rows whose totals do not reconcile to all ingress', () => {
    const result = reconcileOgabasseyBaselineHostEvidence(
      current.hostEvidence.map((row, index) =>
        index === 0 ? { ...row, requestCount: row.requestCount - 1 } : row
      ),
      current.discoveredHostnames,
      current.allIngressRequests,
      current.allIngressOriginAttempts
    );

    expect(result).toEqual({
      ok: false,
      reason: 'host_traffic_evidence_invalid',
    });
  });

  it('uses only eligible static traffic for the avoidance threshold', async () => {
    const result = evaluateOgabasseyOriginBusinessCase(
      {
        ...current,
        allIngressOriginAttempts: 10,
        hostEvidence: current.hostEvidence.map((row, index) =>
          index === 0
            ? {
                ...row,
                originAttemptCount: 10,
                eligibleStaticRequestCount: 990,
                eligibleStaticOriginAttemptCount: 0,
                dynamicRequestCount: 10,
                dynamicOriginAttemptCount: 10,
              }
            : row
        ),
        workersLogsContract: await currentWithWorkersLogsContract(),
      },
      { now }
    );

    expect(result).toEqual({
      verdict: 'STOP',
      reasonCodes: ['origin_avoidance_target_met'],
    });
  });
});
