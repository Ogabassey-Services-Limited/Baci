import { describe, expect, it } from 'vitest';
import { parseMeasurementArguments } from './measure-cloudflare-evidence-sources';

describe('parseMeasurementArguments', () => {
  it('requires a fresh read-only measurement run and has no apply mode', () => {
    expect(parseMeasurementArguments(['--run', 'run-123']).runId).toBe(
      'run-123'
    );
    expect(() =>
      parseMeasurementArguments(['--run', 'run-123', '--apply'])
    ).toThrow('read-only');
  });
});
