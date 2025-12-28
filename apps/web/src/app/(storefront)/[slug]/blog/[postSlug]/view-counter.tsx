'use client';

import { useEffect, useRef } from 'react';
import { incrementViewCount } from './actions';

export function ViewCounter({ postId }: { postId: string }) {
  const hasIncremented = useRef(false);

  useEffect(() => {
    if (!hasIncremented.current) {
      hasIncremented.current = true;
      incrementViewCount(postId);
    }
  }, [postId]);

  return null;
}
