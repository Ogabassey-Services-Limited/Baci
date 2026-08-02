import { describe, expect, it } from 'vitest';
import { evaluateOgabasseyOriginBusinessCase } from './ogabassey-current-origin-baseline';
import {
  current,
  currentWithWorkersLogsContract,
} from './ogabassey-current-origin-baseline.test-fixtures';

describe('Ogabassey baseline operational headroom', () => {
  it('applies traffic and error headroom before forced-sampling margin', async () => {
    const contract = await currentWithWorkersLogsContract({
      currentUtcDayAllAccountEvents: 4_999_998_800n,
    });
    const input = { ...current, workersLogsContract: contract };
    const now = new Date('2026-08-01T12:00:00.000Z');

    expect(
      evaluateOgabasseyOriginBusinessCase(
        {
          ...input,
          ownerApprovedTrafficHeadroomMultiplier: '1.00',
          ownerApprovedErrorHeadroomMultiplier: '1.00',
        },
        { now }
      ).verdict
    ).toBe('PROCEED');
    for (const headroom of [
      {
        ownerApprovedTrafficHeadroomMultiplier: '1.50',
        ownerApprovedErrorHeadroomMultiplier: '1.00',
      },
      {
        ownerApprovedTrafficHeadroomMultiplier: '1.00',
        ownerApprovedErrorHeadroomMultiplier: '1.50',
      },
    ]) {
      expect(
        evaluateOgabasseyOriginBusinessCase({ ...input, ...headroom }, { now })
      ).toEqual({
        verdict: 'STOP',
        reasonCodes: ['workers_logs_forced_sampling_headroom_insufficient'],
      });
    }
  });
});
