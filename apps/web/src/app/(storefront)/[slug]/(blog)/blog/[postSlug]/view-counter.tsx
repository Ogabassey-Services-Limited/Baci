'use client';

import { useEffect, useRef } from 'react';
import { incrementViewCount } from './actions';

/**
 * Tracks blog post views with session-level deduplication.
 * Uses sessionStorage to prevent inflated counts from refreshes
 * and useRef to prevent double-fire from React StrictMode.
 */
export function ViewCounter({ postId }: { postId: string }) {
  const hasIncremented = useRef(false);

  useEffect(() => {
    if (hasIncremented.current) return;
    hasIncremented.current = true;

    const storageKey = `blog-viewed-${postId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // sessionStorage unavailable (SSR, private browsing) — allow the count
    }

    incrementViewCount(postId);
  }, [postId]);

  return null;
}
