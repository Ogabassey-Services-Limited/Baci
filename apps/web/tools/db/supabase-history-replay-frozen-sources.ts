import { migration } from './supabase-history-replay-migration-path';
import type { FrozenReplaySource } from './supabase-history-replay-types';

export function parseFrozenSources(rows: string): FrozenReplaySource[] {
  return rows
    .trim()
    .split('\n')
    .map((row) => {
      const separator = row.indexOf(' ');
      if (separator < 1 || separator === row.length - 1) {
        throw new Error('Invalid frozen replay source row');
      }
      return {
        repositoryPath: migration(row.slice(separator + 1)),
        sha256: row.slice(0, separator),
      };
    });
}
