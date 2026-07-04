import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleIdleBoot } from './schedule-idle-boot';

interface IdleCallbackStub {
  request: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  run: () => void;
}

function stubRequestIdleCallback(): IdleCallbackStub {
  let pending: (() => void) | undefined;
  const request = vi.fn((callback: () => void) => {
    pending = callback;
    return 1;
  });
  const cancel = vi.fn();

  vi.stubGlobal('requestIdleCallback', request);
  vi.stubGlobal('cancelIdleCallback', cancel);

  return {
    request,
    cancel,
    run: () => pending?.(),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('scheduleIdleBoot', () => {
  it('never runs the callback and returns a no-op canceller without a window', () => {
    // Arrange
    vi.stubGlobal('window', undefined);
    const callback = vi.fn();

    // Act
    const cancel = scheduleIdleBoot(callback);
    cancel();

    // Assert
    expect(callback).not.toHaveBeenCalled();
  });

  it('defers the callback instead of running it synchronously', () => {
    // Arrange
    vi.useFakeTimers();
    const callback = vi.fn();

    // Act
    scheduleIdleBoot(callback, { timeoutMs: 4000 });

    // Assert
    expect(callback).not.toHaveBeenCalled();
  });

  it('runs the callback once the browser reports an idle period', () => {
    // Arrange
    const idle = stubRequestIdleCallback();
    const callback = vi.fn();

    // Act
    scheduleIdleBoot(callback, { timeoutMs: 4000 });
    expect(callback).not.toHaveBeenCalled();
    idle.run();

    // Assert
    expect(idle.request).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('boots immediately on the first pointer interaction before idle', () => {
    // Arrange
    stubRequestIdleCallback();
    const callback = vi.fn();

    // Act
    scheduleIdleBoot(callback, { timeoutMs: 4000 });
    window.dispatchEvent(new Event('pointerdown'));

    // Assert
    expect(callback).toHaveBeenCalledOnce();
  });

  it('boots on the first keydown interaction', () => {
    // Arrange
    stubRequestIdleCallback();
    const callback = vi.fn();

    // Act
    scheduleIdleBoot(callback, { timeoutMs: 4000 });
    window.dispatchEvent(new Event('keydown'));

    // Assert
    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs via the idle fallback timer when requestIdleCallback is unavailable', () => {
    // Arrange
    vi.useFakeTimers();
    const callback = vi.fn();

    // Act
    scheduleIdleBoot(callback, { timeoutMs: 4000 });
    vi.advanceTimersByTime(0);

    // Assert
    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs on the hard timeout when the window has not finished loading', () => {
    // Arrange
    vi.useFakeTimers();
    const readyState = vi
      .spyOn(document, 'readyState', 'get')
      .mockReturnValue('loading');
    const callback = vi.fn();

    // Act
    scheduleIdleBoot(callback, { timeoutMs: 4000 });
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);

    // Assert
    expect(callback).toHaveBeenCalledOnce();
    readyState.mockRestore();
  });

  it('runs the callback at most once across triggers', () => {
    // Arrange
    const idle = stubRequestIdleCallback();
    const callback = vi.fn();

    // Act
    scheduleIdleBoot(callback, { timeoutMs: 4000 });
    window.dispatchEvent(new Event('pointerdown'));
    idle.run();
    window.dispatchEvent(new Event('keydown'));

    // Assert
    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not run the callback after the canceller fires', () => {
    // Arrange
    const idle = stubRequestIdleCallback();
    const callback = vi.fn();

    // Act
    const cancel = scheduleIdleBoot(callback, { timeoutMs: 4000 });
    cancel();
    idle.run();
    window.dispatchEvent(new Event('pointerdown'));

    // Assert
    expect(callback).not.toHaveBeenCalled();
    expect(idle.cancel).toHaveBeenCalledOnce();
  });
});
