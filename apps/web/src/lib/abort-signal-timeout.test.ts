import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAbortSignalTimeout } from './abort-signal-timeout';

const originalTimeoutDescriptor = Object.getOwnPropertyDescriptor(
  AbortSignal,
  'timeout'
);

function restoreAbortSignalTimeout() {
  if (originalTimeoutDescriptor) {
    Object.defineProperty(AbortSignal, 'timeout', originalTimeoutDescriptor);
  }
}

describe('createAbortSignalTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    restoreAbortSignalTimeout();
  });

  it('uses the native AbortSignal.timeout when available', () => {
    const nativeSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(nativeSignal);

    const handle = createAbortSignalTimeout(800);

    expect(timeoutSpy).toHaveBeenCalledWith(800);
    expect(handle.signal).toBe(nativeSignal);
    expect(() => handle.clear()).not.toThrow();
  });

  it('falls back to AbortController when native timeout is unavailable', () => {
    vi.useFakeTimers();
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      value: undefined,
    });

    const handle = createAbortSignalTimeout(800);

    expect(handle.signal.aborted).toBe(false);
    vi.advanceTimersByTime(799);
    expect(handle.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(handle.signal.aborted).toBe(true);
  });

  it('clears the fallback timer', () => {
    vi.useFakeTimers();
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      value: undefined,
    });

    const handle = createAbortSignalTimeout(800);
    handle.clear();
    vi.advanceTimersByTime(800);

    expect(handle.signal.aborted).toBe(false);
  });
});
