import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../supabase/migrations/20260804090000_quiz_live_event_foundation.sql'
);
const sql = readFileSync(migrationPath, 'utf8');

describe('quiz live foundation migration', () => {
  it('adds versioned event and immutable attempt acceptance fields', () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live'/i
    );
    expect(sql).toMatch(/contract_version integer NOT NULL DEFAULT 1/i);
    expect(sql).toMatch(/results_published_at timestamptz/i);
    expect(sql).toMatch(/leaderboard_username text/i);
    expect(sql).toMatch(/terms_accepted_at timestamptz/i);
    expect(sql).toMatch(/start_request_id uuid/i);
    expect(sql).toMatch(/option_order jsonb NOT NULL/i);
    expect(sql).toMatch(/username_changed_at timestamptz/i);
  });

  it('enforces one active attempt and idempotent deliberate starts', () => {
    expect(sql).toMatch(
      /UNIQUE INDEX[\s\S]*event_id, customer_id, start_request_id/i
    );
    expect(sql).toMatch(
      /UNIQUE INDEX[\s\S]*event_id, customer_id[\s\S]*WHERE status = 'started'/i
    );
    expect(sql).toMatch(
      /'test_reset'[\s\S]*'tester_revoked'[\s\S]*'event_cancelled'/i
    );
  });

  it('stores tester and invite authority without raw invite tokens', () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.quiz_event_testers/i
    );
    expect(sql).toMatch(/UNIQUE \(event_id, user_id\)/i);
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.quiz_test_invites/i
    );
    expect(sql).toMatch(/token_digest text NOT NULL UNIQUE/i);
    expect(sql).not.toMatch(/\braw_token\b|\btoken\s+text/i);
    expect(sql).toMatch(/interval '30 minutes'/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });

  it('redeems one invite under authenticated identity and a row lock', () => {
    expect(sql).toMatch(
      /FUNCTION public\.redeem_quiz_test_invite_v2\(p_token text\)/i
    );
    expect(sql).toMatch(/v_caller uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/extensions\.digest/i);
    expect(sql).toMatch(/FOR UPDATE OF invite/i);
    expect(sql).toMatch(/invite\.used_at IS NULL/i);
    expect(sql).toMatch(/invite\.revoked_at IS NULL/i);
    expect(sql).toMatch(
      /invite\.expires_at > pg_catalog\.clock_timestamp\(\)/i
    );
    expect(sql).toMatch(/event\.status IN \('scheduled', 'active'\)/i);
    expect(sql).toMatch(/event\.ends_at > pg_catalog\.clock_timestamp\(\)/i);
    expect(sql).not.toMatch(/event\.status IN \([^)]*'draft'/i);
  });
});
