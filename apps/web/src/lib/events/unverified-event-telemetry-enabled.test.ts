import { afterEach, describe, expect, it } from 'vitest';
import { isUnverifiedEventTelemetryEnabled } from './unverified-event-telemetry-enabled';

const original = process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY;

afterEach(() => {
  if (original === undefined)
    delete process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY;
  else process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY = original;
});

describe('isUnverifiedEventTelemetryEnabled', () => {
  it('allows unverified telemetry only for the exact true value', () => {
    delete process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY;
    expect(isUnverifiedEventTelemetryEnabled()).toBe(false);
    process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY = 'true';
    expect(isUnverifiedEventTelemetryEnabled()).toBe(true);
  });

  it.each([
    'false',
    'TRUE',
    '1',
    ' true ',
  ])('rejects the non-canonical value %s', (value) => {
    process.env.EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY = value;
    expect(isUnverifiedEventTelemetryEnabled()).toBe(false);
  });
});
