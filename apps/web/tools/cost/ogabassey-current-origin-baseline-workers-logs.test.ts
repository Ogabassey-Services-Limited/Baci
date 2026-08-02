import { describe, expect, it } from 'vitest';
import { currentWithWorkersLogsContract } from './ogabassey-current-origin-baseline.test-fixtures';
import {
  isRetrievedCloudflareWorkersLogsContract,
  validateWorkersLogsEvidence,
} from './ogabassey-current-origin-baseline-workers-logs';

describe('Ogabassey Workers Logs capability', () => {
  it('brands only contracts retrieved with the authenticated provider receipt', async () => {
    const capability = await currentWithWorkersLogsContract();

    expect(isRetrievedCloudflareWorkersLogsContract(capability)).toBe(true);
    expect(isRetrievedCloudflareWorkersLogsContract({ ...capability })).toBe(
      false
    );
    expect(capability.provenance).toMatchObject({
      kind: 'authenticated_provider_retrieval',
    });
  });

  it('applies traffic and error headroom before the additional four-times margin', async () => {
    const contract = await currentWithWorkersLogsContract({
      currentUtcDayAllAccountEvents: 4_999_998_800n,
    });
    const now = new Date('2026-08-01T12:00:00.000Z');
    const base = validateWorkersLogsEvidence(
      contract,
      143n,
      2n,
      1_000,
      7,
      { trafficMultiplier: '1.00', errorMultiplier: '1.00' },
      now
    );
    expect(base).toMatchObject({ ok: true });

    const trafficHeadroom = validateWorkersLogsEvidence(
      contract,
      143n,
      2n,
      1_000,
      7,
      { trafficMultiplier: '1.50', errorMultiplier: '1.00' },
      now
    );
    expect(trafficHeadroom).toEqual({
      ok: false,
      verdict: 'STOP',
      reason: 'workers_logs_forced_sampling_headroom_insufficient',
    });

    const errorHeadroom = validateWorkersLogsEvidence(
      contract,
      143n,
      2n,
      1_000,
      7,
      { trafficMultiplier: '1.00', errorMultiplier: '1.50' },
      now
    );
    expect(errorHeadroom).toEqual({
      ok: false,
      verdict: 'STOP',
      reason: 'workers_logs_forced_sampling_headroom_insufficient',
    });
  });

  it('fails closed when either owner-approved headroom multiplier is missing or below one', async () => {
    const contract = await currentWithWorkersLogsContract();
    const now = new Date('2026-08-01T12:00:00.000Z');
    for (const headroom of [
      { trafficMultiplier: undefined, errorMultiplier: '1.00' },
      { trafficMultiplier: '1.00', errorMultiplier: '0.99' },
      { trafficMultiplier: 'not-a-multiplier', errorMultiplier: '1.00' },
    ]) {
      expect(
        validateWorkersLogsEvidence(contract, 143n, 2n, 1_000, 7, headroom, now)
      ).toEqual({
        ok: false,
        verdict: 'NOT_PROVEN',
        reason: 'workers_logs_headroom_invalid',
      });
    }
  });
});
