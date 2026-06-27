const DISALLOWED_RAW_TEXT_BLOCK_REGEX =
  /<(script|style|xmp|iframe|noembed|noframes|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

export function stripDisallowedRawTextBlocks(dirty: string): string {
  return dirty.replace(DISALLOWED_RAW_TEXT_BLOCK_REGEX, '');
}
