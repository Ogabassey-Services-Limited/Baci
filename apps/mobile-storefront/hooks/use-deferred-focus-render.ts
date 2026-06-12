import { useEffect, useState } from 'react';

const DEFAULT_FOCUS_RENDER_DELAY_MS = 120;

const idleGlobal = globalThis as unknown as {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
};

export function useDeferredFocusRender(
  isFocused: boolean,
  delayMs = DEFAULT_FOCUS_RENDER_DELAY_MS
) {
  const [shouldRender, setShouldRender] = useState(false);
  const [prevIsFocused, setPrevIsFocused] = useState(isFocused);
  const [prevDelayMs, setPrevDelayMs] = useState(delayMs);

  // Reset inline during render when the inputs change so consumers never see
  // one stale frame (react.dev: "Adjusting some state when a prop changes").
  if (isFocused !== prevIsFocused || delayMs !== prevDelayMs) {
    setPrevIsFocused(isFocused);
    setPrevDelayMs(delayMs);
    setShouldRender(false);
  }

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (typeof idleGlobal.requestIdleCallback === 'function') {
      const idleCallbackId = idleGlobal.requestIdleCallback(
        () => {
          setShouldRender(true);
        },
        { timeout: delayMs }
      );

      return () => {
        idleGlobal.cancelIdleCallback?.(idleCallbackId);
      };
    }

    const timeoutId = setTimeout(() => {
      setShouldRender(true);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [delayMs, isFocused]);

  return shouldRender;
}
