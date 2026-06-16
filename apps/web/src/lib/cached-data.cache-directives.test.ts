import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CACHED_DATA_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'cached-data.ts'),
  'utf8'
);

function getFunctionSource(functionName: string): string {
  const start = CACHED_DATA_SOURCE.indexOf(
    `export async function ${functionName}(`
  );
  if (start === -1) {
    throw new Error(`Unable to locate ${functionName} in cached-data.ts`);
  }

  const bodyStart = CACHED_DATA_SOURCE.indexOf('{', start);
  if (bodyStart === -1) {
    throw new Error(`Unable to locate ${functionName} body in cached-data.ts`);
  }

  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let inBlockComment = false;
  let inLineComment = false;

  for (let index = bodyStart; index < CACHED_DATA_SOURCE.length; index += 1) {
    const char = CACHED_DATA_SOURCE[index];
    const nextChar = CACHED_DATA_SOURCE[index + 1];
    const previousChar = CACHED_DATA_SOURCE[index - 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === quote && previousChar !== '\\') quote = null;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return CACHED_DATA_SOURCE.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Unable to locate ${functionName} end in cached-data.ts`);
}

describe('cached-data cache directives', () => {
  it('keeps hot storefront merchant lookups off the remote cache handler', () => {
    for (const functionName of [
      'getCachedMerchant',
      'getCachedMerchantByDomain',
      'getCachedFeatureSettings',
    ]) {
      const source = getFunctionSource(functionName);
      expect(source, functionName).toContain("'use cache';");
      expect(source, functionName).not.toContain("'use cache: remote';");
    }
  });
});
