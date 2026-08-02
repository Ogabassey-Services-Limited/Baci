import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceMeasurementDependencies } from './measure-cloudflare-evidence-sources';
import {
  parseMeasurementArguments,
  runMeasurementEntrypoint,
} from './measure-cloudflare-evidence-sources';

describe('parseMeasurementArguments', () => {
  it('requires a fresh read-only measurement run and has no apply mode', () => {
    const runId = '0123456789abcdef0123456789abcdef';
    expect(parseMeasurementArguments(['--run', runId]).runId).toBe(runId);
    expect(parseMeasurementArguments(['--revoke-read', runId]).mode).toBe(
      'revoke-read'
    );
    expect(() =>
      parseMeasurementArguments(['--run', runId, '--apply'])
    ).toThrow('read-only');
  });
});

describe('runMeasurementEntrypoint', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps invalid argument errors in the promise rejection path', async () => {
    const loadDependencies = vi.fn(
      async (
        _runId: string,
        _stateDir: string
      ): Promise<EvidenceMeasurementDependencies> => {
        throw new Error('dependency loader should not run');
      }
    );
    await expect(
      runMeasurementEntrypoint(
        ['--run', 'not-a-run-id'],
        '/tmp/state',
        loadDependencies
      )
    ).rejects.toThrow('read-only');
    expect(loadDependencies).not.toHaveBeenCalled();
  });

  it('rejects an inherited write credential before loading measurement dependencies', async () => {
    vi.stubEnv('CLOUDFLARE_WRITE_TOKEN', 'write-token');
    const loadDependencies = vi.fn();
    await expect(
      runMeasurementEntrypoint(
        ['--run', '0123456789abcdef0123456789abcdef'],
        '/tmp/state',
        loadDependencies
      )
    ).rejects.toThrow('measurement process inherited a write credential');
    expect(loadDependencies).not.toHaveBeenCalled();
  });
});
