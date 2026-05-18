'use client';

import { useEffect } from 'react';

interface BlogPostViewTrackerProps {
  slug: string;
}

export function BlogPostViewTracker({ slug }: BlogPostViewTrackerProps) {
  useEffect(() => {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) {
      return;
    }

    const query = new URLSearchParams({
      slug: normalizedSlug,
      trackView: '1',
    });

    void fetch(`/api/blog/posts?${query.toString()}`, {
      cache: 'no-store',
      keepalive: true,
      method: 'GET',
    }).catch((error) => {
      console.error('Failed to track platform blog post view:', {
        error,
        slug: normalizedSlug,
      });
    });
  }, [slug]);

  return null;
}
