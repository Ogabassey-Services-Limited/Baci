import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useDeferredFocusRender } from './use-deferred-focus-render';

const idleGlobal = globalThis as unknown as {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
};
const originalCancelIdleCallback = idleGlobal.cancelIdleCallback;
const originalRequestIdleCallback = idleGlobal.requestIdleCallback;

const idleDeadline: IdleDeadline = {
  didTimeout: false,
  timeRemaining: () => 50,
};

interface FocusRenderProps {
  isFocused: boolean;
}

describe('useDeferredFocusRender', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    idleGlobal.requestIdleCallback = originalRequestIdleCallback;
    idleGlobal.cancelIdleCallback = originalCancelIdleCallback;
  });

  it('waits for idle time before rendering focused work', () => {
    let pendingIdleCallback: IdleRequestCallback | null = null;
    idleGlobal.requestIdleCallback = jest.fn(
      (callback: IdleRequestCallback) => {
        pendingIdleCallback = callback;
        return 7;
      }
    );
    idleGlobal.cancelIdleCallback = jest.fn();

    const { result } = renderHook(() => useDeferredFocusRender(true));

    expect(result.current).toBe(false);

    act(() => {
      pendingIdleCallback?.(idleDeadline);
    });

    expect(result.current).toBe(true);
  });

  it('cancels pending idle work and resets when focus is lost', () => {
    idleGlobal.requestIdleCallback = jest.fn(() => 9);
    idleGlobal.cancelIdleCallback = jest.fn();

    const { result, rerender } = renderHook<boolean, FocusRenderProps>(
      ({ isFocused }) => useDeferredFocusRender(isFocused),
      { initialProps: { isFocused: true } }
    );

    expect(result.current).toBe(false);

    rerender({ isFocused: false });

    expect(idleGlobal.cancelIdleCallback).toHaveBeenCalledWith(9);
    expect(result.current).toBe(false);
  });

  it('falls back to a timer when idle callbacks are unavailable', () => {
    idleGlobal.requestIdleCallback = undefined;
    idleGlobal.cancelIdleCallback = undefined;

    const { result } = renderHook(() => useDeferredFocusRender(true, 50));

    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(result.current).toBe(true);
  });
});
