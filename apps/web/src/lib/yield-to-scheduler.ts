interface SchedulerWithYield {
  yield?: () => Promise<void>;
}

/**
 * Yield the main thread back to the browser so a pending user interaction can
 * paint before the next chunk of synchronous work runs (INP presentation
 * delay). Uses the Prioritized Task Scheduling API's `scheduler.yield()` when
 * available (continuation keeps the inherited user-blocking priority);
 * otherwise resolves immediately as a no-op so unsupported browsers keep the
 * exact current behavior.
 */
export async function yieldToScheduler(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const scheduler = (window as Window & { scheduler?: SchedulerWithYield })
    .scheduler;

  if (scheduler && typeof scheduler.yield === 'function') {
    try {
      await scheduler.yield();
    } catch {
      // A rejected yield (e.g. aborted task signal) must never break the
      // interaction handler that awaited it — fall through as a no-op.
    }
  }
}
