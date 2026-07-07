// Sleep that wakes IMMEDIATELY when the signal aborts (resolving, not
// rejecting — callers decide what an abort means). Used for retry backoff so
// an attempt whose deadline fires mid-sleep doesn't idle past its budget.
export function abortableDelay(
  ms: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    if (!signal) {
      setTimeout(resolve, ms);
      return;
    }
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
