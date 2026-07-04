/**
 * Canonical string form of stored blog content for scanning/serialization.
 * Content is either raw HTML/markdown (string) or a TipTap JSON document
 * (object); anything else contributes nothing. Shared by link-target
 * collection and content resolution so the two can never desync.
 */
export function stringifyBlogContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  return content && typeof content === 'object' ? JSON.stringify(content) : '';
}
