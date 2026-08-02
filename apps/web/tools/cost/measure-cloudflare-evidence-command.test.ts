import { describe, expect, it } from 'vitest';
import { parseMeasurementArguments } from './measure-cloudflare-evidence-command';

describe('measurement command parser', () => {
  it('accepts receipt-only read-token recovery', () => {
    expect(
      parseMeasurementArguments([
        '--record-read-revocation',
        '0123456789abcdef0123456789abcdef',
      ])
    ).toEqual({
      mode: 'record-read-revocation',
      runId: '0123456789abcdef0123456789abcdef',
    });
  });
});
