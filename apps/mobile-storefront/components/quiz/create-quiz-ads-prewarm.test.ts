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

  it('waits for consent UI before starting the bounded SDK preparation timeout', async () => {
    jest.useFakeTimers();
    let resolveConsent!: () => void;
    const prepare = Object.assign(
      jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      {
        prepareConsent: () =>
          new Promise<void>((resolve) => {
            resolveConsent = resolve;
          }),
      }
    );
    const onFinished = jest.fn();
    const prewarm = createQuizAdsPrewarm(prepare, onFinished);

    await Promise.resolve();
    jest.advanceTimersByTime(1500);
    await Promise.resolve();
    expect(prepare).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();

    resolveConsent();
    await expect(prewarm.promise).resolves.toBe(true);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith(false);
  });
});
