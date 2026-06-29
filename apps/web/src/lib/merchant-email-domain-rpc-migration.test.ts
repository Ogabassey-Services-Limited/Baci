import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260627061500_harden_merchant_email_domain_write_rpcs.sql'
  ),
  'utf8'
);

const legacyDirectDmlMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20260627053000_authenticated_merchant_email_domain_writes.sql'
  ),
  'utf8'
);

describe('merchant email-domain write RPC migration', () => {
  it('does not grant authenticated callers direct table writes', () => {
    expect(legacyDirectDmlMigrationSql).not.toContain(
      'grant insert, update on public.merchant_email_domains to authenticated'
    );
    expect(legacyDirectDmlMigrationSql).toContain(
      'revoke insert, update on public.merchant_email_domains from authenticated'
    );
    expect(legacyDirectDmlMigrationSql).toContain(
      'drop policy if exists "merchant_email_domains_owner_insert"'
    );
    expect(legacyDirectDmlMigrationSql).toContain(
      'drop policy if exists "merchant_email_domains_owner_update"'
    );
  });

  it('keeps provider-controlled writes behind service-role-only owner-scoped RPCs', () => {
    expect(migrationSql).toContain(
      'revoke insert, update on public.merchant_email_domains from authenticated'
    );
    expect(migrationSql).toMatch(/security definer\s+set search_path = ''/);
    expect(migrationSql).toContain(
      'revoke all on function public.save_merchant_email_domain_registration'
    );
    expect(migrationSql).toContain('from public, anon, authenticated');
    expect(migrationSql).toContain(
      'grant execute on function public.save_merchant_email_domain_registration'
    );
    expect(migrationSql).toContain(
      'grant execute on function public.save_merchant_email_domain_verification'
    );
    expect(migrationSql).toContain('to service_role');
    expect(migrationSql).not.toContain('to authenticated');
    expect(migrationSql).toContain('p_actor_user_id uuid');
  });

  it('does not preserve enabled verification state when the provider is no longer verified', () => {
    expect(migrationSql).toContain(
      "when p_status = 'verified' then 'verified'"
    );
    expect(migrationSql).toContain(
      "and excluded.status = 'verified' then med.status"
    );
    expect(migrationSql).toContain(
      "and excluded.status = 'verified' then med.enabled"
    );
    expect(migrationSql).toContain('else false');
  });
});
