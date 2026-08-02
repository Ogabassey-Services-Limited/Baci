import { describe, expect, it } from 'vitest';
import {
  REVIEWED_EVIDENCE_PROBE_MATRIX,
  REVIEWED_PROBE_CASE_IDS,
  validateEvidenceProbeResults,
} from './mutate-cloudflare-evidence-probes';
import { createReviewedTemporaryRuleBinding } from './mutate-cloudflare-evidence-rule-binding';

const runId = '0123456789abcdef0123456789abcdef';
const headers = createReviewedTemporaryRuleBinding(runId).headers;
const valid = REVIEWED_EVIDENCE_PROBE_MATRIX.map(({ method, path }, index) => ({
  id: `provider-${index}`,
  succeeded: true,
  hostname: 'edge-evidence.ogabassey.com',
  method,
  path,
  headers,
}));

describe('reviewed evidence probe matrix', () => {
  it('records deterministic reviewed case IDs in matrix order', () => {
    expect(validateEvidenceProbeResults(runId, [...valid].reverse())).toEqual([
      ...REVIEWED_PROBE_CASE_IDS,
    ]);
  });

  it('rejects a skipped path even when the bounded count is filled', () => {
    expect(() =>
      validateEvidenceProbeResults(runId, [
        valid[0],
        { ...valid[0], id: 'other' },
      ])
    ).toThrow('reviewed matrix');
  });

  it('rejects duplicated provider receipts and a nonce from another run', () => {
    expect(() =>
      validateEvidenceProbeResults(runId, [
        valid[0],
        { ...valid[1], id: valid[0].id },
      ])
    ).toThrow('unique');
    expect(() =>
      validateEvidenceProbeResults(runId, [
        valid[0],
        {
          ...valid[1],
          headers: createReviewedTemporaryRuleBinding('f'.repeat(32)).headers,
        },
      ])
    ).toThrow('reviewed matrix');
  });

  it('rejects probe headers with unreviewed fields', () => {
    expect(() =>
      validateEvidenceProbeResults(runId, [
        { ...valid[0], headers: [{ ...headers[0], extra: 'unreviewed' }] },
        valid[1],
      ])
    ).toThrow('reviewed matrix');
  });
});
