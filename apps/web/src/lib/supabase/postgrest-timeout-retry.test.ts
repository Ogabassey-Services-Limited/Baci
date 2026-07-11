import { PostgrestClient } from '@supabase/postgrest-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the root mechanism behind the ~34s compare-page stall.
 *
 * The shared cached Supabase client bounds every fetch with
 * `AbortSignal.timeout()` (see createTimeoutComposedFetch), which rejects with
 * a NATIVE `TimeoutError` — not `AbortError`. The installed postgrest-js
 * (2.108.2) only suppresses its automatic GET retry for `AbortError` /
 * `ABORT_ERR`, so a `TimeoutError` is treated as retryable and fans out into 4
 * attempts (1/2/4s backoff ≈ 34s). Optional per-request compare reads
 * (getCachedProductSemanticInventory, getPublishedClusterPosts) disable that
 * retry with `.retry(false)`. These tests pin both halves of that contract
 * against the real SDK so a dependency bump or a dropped `.retry(false)` fails
 * loudly instead of silently re-introducing the stall.
 */
function timeoutError(): DOMException {
  return new DOMException('The operation timed out', 'TimeoutError');
}

describe('postgrest-js TimeoutError retry contract (installed 2.108.2)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // postgrest-js RESOLVES its thenable with a `{ data, error }` result even on
  // a fetch failure (it does not reject), so the meaningful signal is the
  // number of fetch attempts, not resolve-vs-reject.
  //
  // The pair below pins the mechanism without a slow/flaky multi-retry timer
  // dance: a genuine AbortError makes exactly ONE attempt (the SDK suppresses
  // retries for it), while a TimeoutError needs an explicit retry(false) to be
  // held to one attempt — i.e. without the fix a TimeoutError is NOT suppressed
  // and would retry (the ~34s storm).
  it('makes exactly one attempt on TimeoutError when retry(false) is set — the fix', async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      return Promise.reject(timeoutError());
    });
    const client = new PostgrestClient('http://postgrest.test', {
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.from('products').select('slug').retry(false);

    expect(calls).toBe(1);
  });

  it('does not retry a genuine AbortError even with retries enabled', async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    });
    const client = new PostgrestClient('http://postgrest.test', {
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.from('products').select('slug');

    // Confirms the SDK's retry-suppression keys on AbortError only — which is
    // exactly why AbortSignal.timeout()'s TimeoutError slipped through.
    expect(calls).toBe(1);
  });
});
