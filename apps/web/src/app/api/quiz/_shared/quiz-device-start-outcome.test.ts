import { describe, expect, it } from 'vitest';
import { interpretQuizDeviceStartOutcome } from './quiz-device-start-outcome';

describe('interpretQuizDeviceStartOutcome', () => {
  it('strips internal device fields from a device-start result', () => {
    expect(
      interpretQuizDeviceStartOutcome(
        {
          attemptId: 'attempt-1',
          deviceAllowed: true,
          deviceBindingFailed: false,
        },
        true
      )
    ).toEqual({
      deviceAllowed: true,
      deviceBindingFailed: false,
      startData: { attemptId: 'attempt-1' },
    });
  });

  it('leaves a start result unchanged when no device hash was used', () => {
    const startData = { attemptId: 'attempt-1' };

    expect(interpretQuizDeviceStartOutcome(startData, false)).toEqual({
      deviceAllowed: undefined,
      deviceBindingFailed: undefined,
      startData,
    });
  });
});
