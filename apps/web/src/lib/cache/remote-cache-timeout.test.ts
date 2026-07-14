// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CacheBackendTimeoutError,
  withTimeout,
} from './remote-cache-timeout.mjs';

/** INVARIANT B — no await on the backend may hang. */
describe('withTimeout', () => {
  let unhandled: unknown[];
  let onUnhandled: (reason: unknown) => void;

  beforeEach(() => {
    unhandled = [];
    onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  async function flush() {
    for (let i = 0; i < 3; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  it('passes a fast result straight through', async () => {
    await expect(withTimeout(async () => 'ok', 100, 'get')).resolves.toBe('ok');
  });

  it('propagates a rejection unchanged', async () => {
    await expect(
      withTimeout(
        async () => {
          throw new Error('503');
        },
        100,
        'get'
      )
    ).rejects.toThrow('503');
  });

  it('catches a synchronous throw from the operation', async () => {
    await expect(
      withTimeout(
        () => {
          throw new Error('sync boom');
        },
        100,
        'get'
      )
    ).rejects.toThrow('sync boom');
  });

  it('rejects with CacheBackendTimeoutError when the backend hangs', async () => {
    const hang = () => new Promise<string>(() => {});

    await expect(withTimeout(hang, 20, 'set')).rejects.toBeInstanceOf(
      CacheBackendTimeoutError
    );
  });

  it('names the operation in the timeout, never a cache key', async () => {
    const hang = () => new Promise<string>(() => {});

    await expect(withTimeout(hang, 20, 'set')).rejects.toThrow(
      /set\(\) timed out after 20ms/
    );
  });

  it('does not raise an unhandled rejection when the backend rejects AFTER the timeout', async () => {
    // The dangerous shape: we have already given up, then the backend fails.
    // Nothing is awaiting that promise any more.
    const lateReject = () =>
      new Promise<string>((_resolve, reject) => {
        setTimeout(() => reject(new Error('late 503')), 30);
      });

    await expect(withTimeout(lateReject, 10, 'get')).rejects.toBeInstanceOf(
      CacheBackendTimeoutError
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    await flush();

    expect(unhandled).toEqual([]);
  });

  it('clears its timer so a fast call leaves nothing pending', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    await withTimeout(async () => 'ok', 1_000, 'get');

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
