'use client';

import { useEffect, useRef, useState } from 'react';

interface UseEffectiveSearchTermArgs {
  searchTerm: string;
  /** Any non-search inputs whose change should immediately flush the
   *  debounced search to the live `searchTerm`. Order is not significant;
   *  identity (===) is used to detect changes. */
  flushOn: readonly unknown[];
  /** Debounce window in milliseconds for search-only changes. */
  delayMs?: number;
}

/**
 * Returns a "live-aware" debounced search term:
 *
 * - When only `searchTerm` changes, the returned value lags behind by `delayMs`
 *   so the consumer can avoid hitting the server on every keystroke.
 * - When ANY value in `flushOn` changes (filters, pagination, etc.), the
 *   returned value is synchronously flushed to the current `searchTerm` so the
 *   resulting refetch never uses a stale debounced value.
 *
 * The flush happens during render rather than in a useEffect — this ensures
 * downstream effects (e.g. a fetch hook keyed on the same flushOn deps) see
 * the live search term in the very first render after a filter change, not
 * a subsequent one. That matters because such hooks often debounce/throttle
 * their own re-runs and may drop the second update.
 */
export function useEffectiveSearchTerm({
  searchTerm,
  flushOn,
  delayMs = 500,
}: UseEffectiveSearchTermArgs): string {
  const [effective, setEffective] = useState(searchTerm);
  const prevFlushOnRef = useRef(flushOn);

  // Compare each entry in flushOn against the previous render's snapshot.
  let flushOnChanged = prevFlushOnRef.current.length !== flushOn.length;
  if (!flushOnChanged) {
    for (let i = 0; i < flushOn.length; i++) {
      if (prevFlushOnRef.current[i] !== flushOn[i]) {
        flushOnChanged = true;
        break;
      }
    }
  }

  if (flushOnChanged) {
    prevFlushOnRef.current = flushOn;
    if (effective !== searchTerm) {
      // setState during render is supported when the new value is derived from
      // existing state and we guard against infinite loops via the !== check.
      setEffective(searchTerm);
    }
  }

  useEffect(() => {
    if (searchTerm === effective) {
      return;
    }
    const handle = setTimeout(() => {
      setEffective(searchTerm);
    }, delayMs);
    return () => clearTimeout(handle);
  }, [searchTerm, effective, delayMs]);

  return effective;
}
