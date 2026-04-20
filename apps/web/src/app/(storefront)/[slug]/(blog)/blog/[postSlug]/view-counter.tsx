'use client';

import { useEffect, useRef } from 'react';
import { incrementViewCount } from './actions';

/**
 * Tracks blog post views with session-level deduplication.
 * Uses sessionStorage to prevent inflated counts from refreshes
 * and useRef to prevent double-fire from React StrictMode.
 */
export function ViewCounter({ postId }: { postId: string }) {
  // Track the postId we last counted against so navigating between blog posts
  // (same component instance, new prop) re-arms the increment instead of
  // staying stuck on the first post's guard.
  const lastCountedPostIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastCountedPostIdRef.current === postId) return;
    lastCountedPostIdRef.current = postId;

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
