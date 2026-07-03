/**
 * Max ids per Supabase `.in()` filter. Those values are encoded in the request
 * URL, so a large list (bulk token pruning can match thousands of rows) would
 * blow past gateway URL-length limits (~8KB) and 414. Chunk to stay well under.
 */
export const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
