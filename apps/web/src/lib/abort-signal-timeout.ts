export interface AbortSignalTimeoutHandle {
  clear: () => void;
  signal: AbortSignal;
}

export function createAbortSignalTimeout(
  timeoutMs: number
): AbortSignalTimeoutHandle {
  if (typeof AbortSignal.timeout === 'function') {
    return {
      clear: () => undefined,
      signal: AbortSignal.timeout(timeoutMs),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    clear: () => clearTimeout(timeout),
    signal: controller.signal,
  };
}
