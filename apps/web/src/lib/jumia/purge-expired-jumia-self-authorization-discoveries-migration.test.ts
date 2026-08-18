import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../../..');

describe('Jumia discovery purge RPC migration contract', () => {
  it('keeps the anon-callable purge narrowly scoped and security definer', () => {
    const definition = readFileSync(
      path.join(
        workspaceRoot,
        'supabase/migrations/20260814170000_jumia_self_authorization_discovery_hardening.sql'
      ),
      'utf8'
    );
    const grant = readFileSync(
      path.join(
        workspaceRoot,
        'supabase/migrations/20260818130000_allow_anon_jumia_discovery_purge_rpc.sql'
      ),
      'utf8'
    );

    expect(definition).toMatch(
      /FUNCTION public\.purge_expired_jumia_self_authorization_discoveries\(\)[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''[\s\S]*?DELETE FROM public\.jumia_self_authorization_discoveries[\s\S]*?expires_at <= now\(\)[\s\S]*?consumed_at IS NOT NULL/i
    );
    expect(grant).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.purge_expired_jumia_self_authorization_discoveries\(\)\s+TO anon;/i
    );
  });
});
