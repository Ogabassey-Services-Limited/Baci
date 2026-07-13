import { describe, expect, it } from 'vitest';
import { validateCronJobIdentities } from './postgres-baseline-delta-cron.mjs';

const job = {
  active: true,
  command_digest: '4c9b0d8ce51124b8f0c74da2fbe6c352',
  jobid: '1',
  schedule: '0 * * * *',
};

function snapshot(jobIdentities = [job]) {
  return {
    cron: {
      job_identities: jobIdentities,
      jobs: {
        active: String(jobIdentities.filter(({ active }) => active).length),
        total: String(jobIdentities.length),
      },
    },
  };
}

describe('validateCronJobIdentities', () => {
  it('accepts a stable job manifest irrespective of export order', () => {
    const second = {
      ...job,
      active: false,
      command_digest: '5ca21a0ac03d399a6f6db0a272271930',
      jobid: '2',
      schedule: '30 * * * *',
    };

    expect(() =>
      validateCronJobIdentities(
        snapshot([job, second]),
        snapshot([second, job])
      )
    ).not.toThrow();
  });

  it.each([
    ['rescheduled', { ...job, schedule: '*/5 * * * *' }],
    [
      'retargeted',
      { ...job, command_digest: '7ca21a0ac03d399a6f6db0a272271930' },
    ],
    ['replaced', { ...job, jobid: '2' }],
  ])('rejects a %s cron workload change', (_kind, changed) => {
    expect(() =>
      validateCronJobIdentities(snapshot(), snapshot([changed]))
    ).toThrow(/cron workload identity changed/i);
  });
});
