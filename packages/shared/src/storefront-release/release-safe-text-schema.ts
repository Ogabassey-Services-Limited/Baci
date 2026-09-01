import { z } from 'zod';
import { hasUnstableBlogContentMedia } from './has-unstable-blog-content-media';

/** Builds a bounded text schema that only permits immutable release content. */
export function releaseSafeText(maxLength: number, subject: string) {
  return z
    .string()
    .max(maxLength)
    .refine(
      (value) => !hasUnstableBlogContentMedia(value),
      `${subject} links and media must be release-safe`
    );
}
