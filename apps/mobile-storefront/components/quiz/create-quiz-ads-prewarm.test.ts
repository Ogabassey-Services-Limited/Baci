import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createQuizAdsPrewarm } from './create-quiz-ads-prewarm';

describe('createQuizAdsPrewarm', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('aborts optional ad preparation when the start timeout wins', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    let resolvePreparation!: (value: boolean) => void;
    const onFinished = jest.fn();
    const prewarm = createQuizAdsPrewarm((passedSignal) => {
      signal = passedSignal;
      return new Promise<boolean>((resolve) => {
        resolvePreparation = resolve;
      });
    }, onFinished);

    await Promise.resolve();
    jest.advanceTimersByTime(1500);
    await expect(prewarm.promise).resolves.toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(onFinished).toHaveBeenCalledWith(true);

    resolvePreparation(true);
    await Promise.resolve();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
