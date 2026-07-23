import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../supabase/migrations'
);

/** Reads a supabase migration file's raw text for contract assertions. */
export function readByokMigration(fileName: string): string {
  return readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
}
