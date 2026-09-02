import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_BYTES,
  MAX_INPUT_ROWS,
  SERVICE_METRICS,
} from './measure-vercel-storefront-cost-types';

describe('measure-vercel-storefront-cost-types', () => {
  it('keeps the measurement input bounds finite and explicit', () => {
    expect(MAX_INPUT_BYTES).toBe(32 * 1024 * 1024);
    expect(MAX_INPUT_ROWS).toBe(100_000);
  });

  it('maps the Vercel storefront cost services used by the report', () => {
    expect(SERVICE_METRICS['Function Duration']).toBe(
      'functionDurationGbHours'
    );
    expect(SERVICE_METRICS['Function Invocations']).toBe('functionInvocations');
    expect(
      SERVICE_METRICS[
        'Global Config Reads (formerly known as Edge Config Reads)'
      ]
    ).toBe('globalConfigReads');
  });
});
