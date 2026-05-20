import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../supabase/migrations'
);
const foundationSql = readFileSync(
  resolve(migrationsDirectory, '20260516084349_quiz_phase1a_foundation.sql'),
  'utf8'
);
const rpcSql = readFileSync(
  resolve(migrationsDirectory, '20260516084622_quiz_phase1a_rpcs.sql'),
  'utf8'
);

describe('quiz migration RLS contracts', () => {
  it('scopes leaderboard refresh log reads to the authenticated customer merchant', () => {
    expect(foundationSql).toMatch(
      /CREATE\s+POLICY\s+leaderboard_refresh_log_client_read\s+ON\s+public\.leaderboard_refresh_log\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s+\(EXISTS\s+\(SELECT\s+1\s+FROM\s+public\.quiz_events\s+e\s+JOIN\s+public\.customers\s+c\s+ON\s+c\.merchant_id\s*=\s*e\.merchant_id[\s\S]*c\.user_id\s*=\s*\(SELECT\s+auth\.uid\(\)\)\)\)/is
    );
    expect(foundationSql).not.toMatch(
      /leaderboard_refresh_log_client_read[\s\S]*TO\s+anon,\s+authenticated/i
    );
  });

  it('finalizes event awards only after the event has finished', () => {
    const eventFinalizerSql = rpcSql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_quiz_event_awards[\s\S]*?\$\$;/i
    )?.[0];

    expect(eventFinalizerSql).toBeDefined();
    expect(eventFinalizerSql).toMatch(/status\s*=\s*'completed'/i);
    expect(eventFinalizerSql).toMatch(/ends_at\s+<=\s+pg_catalog\.now\(\)/i);
    expect(eventFinalizerSql).toMatch(/award_finalized_at\s+IS\s+NULL/i);
  });
});
