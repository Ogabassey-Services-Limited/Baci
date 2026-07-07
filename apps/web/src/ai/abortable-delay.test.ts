import { describe, expect, it } from 'vitest';
import { abortableDelay } from './abortable-delay';

describe('abortableDelay', () => {
  it('resolves after the delay when no signal is provided', async () => {
    const start = Date.now();
    await abortableDelay(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it('resolves immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const start = Date.now();
    await abortableDelay(5_000, controller.signal);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('wakes early when the signal aborts mid-sleep', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    const start = Date.now();
    await abortableDelay(5_000, controller.signal);
    // Woke on the abort (~10ms), not the 5s timer.
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('completes the full delay when the signal never aborts', async () => {
    const controller = new AbortController();

    const start = Date.now();
    await abortableDelay(20, controller.signal);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});
