import { describe, expect, it } from 'vitest';
import { buildQuizDeviceProofSubject } from './quiz-device-proof-subject';

describe('buildQuizDeviceProofSubject', () => {
  it('binds the device to its scope without exposing either raw value', () => {
    const scopeId = '11111111-1111-4111-8111-111111111111';
    const deviceHash = 'a'.repeat(64);
    const subject = buildQuizDeviceProofSubject(scopeId, deviceHash);

    expect(subject).toBe(
      'device:fcc0562339f8981e647102f5f70222b3574f1c202c4d34feb3c26225ebf400eb'
    );
    expect(subject).not.toContain(scopeId);
    expect(subject).not.toContain(deviceHash);
  });

  it('changes when either the scope or device changes', () => {
    const deviceHash = 'a'.repeat(64);
    const first = buildQuizDeviceProofSubject('scope-1', deviceHash);

    expect(buildQuizDeviceProofSubject('scope-2', deviceHash)).not.toBe(first);
    expect(buildQuizDeviceProofSubject('scope-1', 'b'.repeat(64))).not.toBe(
      first
    );
  });
});
