import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const authenticatedReservationMigration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260827030000_authenticate_paystack_dva_reservations.sql'
  ),
  'utf8'
);
const guardMigration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260827040000_harden_paystack_dva_reservation_guards.sql'
  ),
  'utf8'
);
const guardRepairMigration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260827050000_repair_paystack_dva_alias_snapshot_guards.sql'
  ),
  'utf8'
);

describe('Paystack DVA reservation guard migrations', () => {
  it('requires a server-generated proof before exposing DVA reservation metadata', () => {
    expect(authenticatedReservationMigration).toContain(
      'paystack_dva_reservation_proof_valid'
    );
    expect(authenticatedReservationMigration).toContain(
      'p_provisioning_proof jsonb'
    );
    expect(authenticatedReservationMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.reserve_paystack_order_payment_account'
    );
    expect(authenticatedReservationMigration).toContain(
      'TO anon, authenticated, service_role'
    );
    expect(authenticatedReservationMigration).toContain(
      "USING 'paystack_dva_reservation_secret'"
    );
    expect(authenticatedReservationMigration).toContain(
      "USING 'service_role_key'"
    );
    expect(authenticatedReservationMigration).toContain(
      "'baci.paystack_dva_reservation_verified'"
    );
    expect(authenticatedReservationMigration).toContain(
      'REVOKE ALL ON FUNCTION public.reserve_paystack_order_payment_account(\n  uuid, text, text, text, timestamptz, timestamptz, text\n) FROM PUBLIC, anon, authenticated'
    );
  });

  it('aligns proof verification with the application signer and closes raw inserts', () => {
    const serviceRoleOffset = guardMigration.indexOf(
      "USING 'service_role_key'"
    );
    const dedicatedSecretOffset = guardMigration.indexOf(
      "USING 'paystack_dva_reservation_secret'"
    );

    expect(serviceRoleOffset).toBeGreaterThan(-1);
    expect(dedicatedSecretOffset).toBeGreaterThan(serviceRoleOffset);
    expect(guardMigration).toContain(
      'DROP POLICY IF EXISTS owners_and_staff_insert_order_payment_accounts'
    );
    expect(guardMigration).toContain(
      'REVOKE INSERT ON TABLE public.order_payment_accounts FROM anon, authenticated'
    );
  });

  it('allows only verified proofs to carry an invoice expiry beyond 90 minutes', () => {
    expect(guardMigration).toContain(
      "'baci.paystack_dva_reservation_verified'"
    );
    expect(guardMigration).toContain(
      "NOT v_internal_verified\n        AND NEW.expires_at > NEW.assigned_at + interval '90 minutes'"
    );
  });

  it('expires the source alias before promoting its payable snapshot', () => {
    const sourceExpiryOffset = guardMigration.indexOf(
      'SET expires_at = LEAST(COALESCE(source.expires_at, now()), now())'
    );
    const versionInsertOffset = guardMigration.indexOf(
      'INSERT INTO public.order_payment_accounts ('
    );

    expect(sourceExpiryOffset).toBeGreaterThan(-1);
    expect(versionInsertOffset).toBeGreaterThan(sourceExpiryOffset);
  });

  it('does not update the source row recursively from its payable trigger', () => {
    expect(guardRepairMigration).not.toContain(
      'UPDATE public.order_payment_accounts AS source'
    );
    expect(guardRepairMigration).toContain(
      'NEW.expires_at := LEAST(COALESCE(NEW.expires_at, now()), now())'
    );
    expect(guardRepairMigration).toContain("OLD.provider = 'paystack_version'");
  });

  it('guards wallet aliases when an existing receiver or status is updated', () => {
    expect(guardRepairMigration).toContain(
      'BEFORE INSERT OR UPDATE OF provider, status, account_number'
    );
  });
});
