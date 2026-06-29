import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The send-auth-email edge function is intentionally duplicated: the deployed
// entrypoint at <repo>/supabase/functions/send-auth-email/ and a copy under
// apps/web/supabase/functions/send-auth-email/ (so the web test suite can import
// it). These files live outside the TypeScript compiler's reach, so this guard
// fails CI if the two copies ever drift — a comment alone can't prevent that.
const here = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(resolve(here, relativePath), 'utf8');
}

const DUPLICATED_FILES = ['index.ts', 'auth-email-template.ts'];

describe('send-auth-email duplicated edge function stays in sync', () => {
  for (const file of DUPLICATED_FILES) {
    it(`${file} is byte-identical across both copies`, () => {
      const canonical = read(
        `../../../../supabase/functions/send-auth-email/${file}`
      );
      const webCopy = read(`../../supabase/functions/send-auth-email/${file}`);
      expect(webCopy).toBe(canonical);
    });
  }
});
