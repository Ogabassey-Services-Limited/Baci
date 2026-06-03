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

  useEffect(() => {
    setShouldRender(false);

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
