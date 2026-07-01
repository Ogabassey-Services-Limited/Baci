interface AbortSignalTimeoutHandle {
  clear: () => void;
  signal: AbortSignal;
}

export function createAbortSignalTimeout(
  timeoutMs: number
): AbortSignalTimeoutHandle {
  const nativeTimeout = AbortSignal.timeout;
  if (typeof nativeTimeout === 'function') {
    return {
      clear: () => undefined,
      signal: nativeTimeout(timeoutMs),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    clear: () => clearTimeout(timeout),
    signal: controller.signal,
  };
}
