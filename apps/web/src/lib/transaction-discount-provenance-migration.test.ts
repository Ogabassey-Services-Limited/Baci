import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828020000_authenticate_transaction_discount_metadata.sql'
  ),
  'utf8'
);
const hardenedMigrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828030000_harden_transaction_discount_admin_context.sql'
  ),
  'utf8'
);
const payloadBindingMigrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828040000_bind_transaction_discount_proof_payload.sql'
  ),
  'utf8'
);
const replayBindingMigrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828050000_bind_transaction_discount_proof_replay.sql'
  ),
  'utf8'
);
const replaySignatureBindingMigrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828060000_bind_transaction_discount_replay_signature.sql'
  ),
  'utf8'
);
const historicalBackfillMigrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828070000_backfill_historical_admin_discount_provenance.sql'
  ),
  'utf8'
);
const proofRejectionMigrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260828200000_reject_unverified_transaction_discount_proofs.sql'
  ),
  'utf8'
);

describe('transaction discount provenance migration', () => {
  it('accepts only proof-bound storefront metadata and strips forged markers', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.sanitize_storefront_transaction_discount_metadata\(\)/i
    );
    expect(migrationSql).toMatch(
      /v_proof -> 'payload' = \(v_metadata - 'proof'\)/i
    );
    expect(migrationSql).toMatch(
      /quiz_route_proof_valid\([\s\S]*?'storefront_transaction_discount'/i
    );
    expect(migrationSql).toContain("v_tracking - 'baci_transaction_discount'");
    expect(migrationSql).toMatch(
      /CREATE TRIGGER sanitize_storefront_transaction_discount_metadata[\s\S]*?ON public\.orders/i
    );
  });

  it('scopes admin provenance to the authenticated edit wrapper context', () => {
    expect(migrationSql).toMatch(
      /current_setting\('app\.transaction_discount_admin_edit', true\) = '1'/i
    );
    expect(migrationSql).toMatch(
      /set_config\([\s\S]*?'app\.transaction_discount_admin_edit'[\s\S]*?'1'/i
    );
    expect(migrationSql).toContain(
      "jsonb_build_object('status', 'admin_edit', 'version', 4)"
    );
  });

  it('uses a private transaction context instead of a caller-controlled GUC', () => {
    expect(hardenedMigrationSql).toMatch(
      /CREATE TABLE IF NOT EXISTS private\.transaction_discount_admin_edit_context/i
    );
    expect(hardenedMigrationSql).toMatch(
      /context\.transaction_id = pg_catalog\.txid_current\(\)/i
    );
    expect(hardenedMigrationSql).toMatch(
      /INSERT INTO private\.transaction_discount_admin_edit_context/i
    );
    expect(hardenedMigrationSql).not.toContain(
      'app.transaction_discount_admin_edit'
    );
  });

  it('recomputes the signed payload hash before accepting storefront metadata', () => {
    expect(payloadBindingMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.canonical_jsonb\(p_value jsonb\)/i
    );
    expect(payloadBindingMigrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION private\.transaction_discount_payload_hash\(p_payload jsonb\)/i
    );
    expect(payloadBindingMigrationSql).toMatch(
      /v_proof ->> 'payload_hash'\s*=\s*private\.transaction_discount_payload_hash\(v_proof -> 'payload'\)/i
    );
  });

  it('consumes each storefront transaction discount proof only once', () => {
    expect(replayBindingMigrationSql).toMatch(
      /CREATE TABLE IF NOT EXISTS private\.transaction_discount_proof_replay/i
    );
    expect(replayBindingMigrationSql).toMatch(
      /ON CONFLICT \(proof_id\) DO NOTHING/i
    );
    expect(replayBindingMigrationSql).toMatch(
      /GET DIAGNOSTICS v_inserted_count = ROW_COUNT/i
    );
  });

  it('keys replay consumption by the signed proof instead of proof_id', () => {
    expect(replaySignatureBindingMigrationSql).toMatch(
      /v_proof ->> 'proof_id'\s*=\s*pg_catalog\.left\(v_proof ->> 'signature',\s*24\)/i
    );
    expect(replaySignatureBindingMigrationSql).toMatch(
      /INSERT INTO private\.transaction_discount_proof_replay\s*\(\s*proof_id,\s*order_id,\s*merchant_id\s*\)\s*VALUES\s*\(\s*v_proof ->> 'signature',\s*NEW\.id,\s*NEW\.merchant_id\s*\)/i
    );
  });

  it('keeps the historical backfill temp rows alive until the migration commits', () => {
    expect(historicalBackfillMigrationSql).toMatch(/\nBEGIN;\s/i);
    expect(historicalBackfillMigrationSql).toMatch(
      /CREATE TEMP TABLE historical_admin_discount_edits[\s\S]*?ON COMMIT DROP;/i
    );
    expect(historicalBackfillMigrationSql).toMatch(/\nCOMMIT;\s*$/i);
  });

  it('fails closed when a version-three proof cannot be accepted', () => {
    expect(proofRejectionMigrationSql).toMatch(
      /v_metadata ->> 'version' = '3'[\s\S]*?v_metadata \? 'proof'[\s\S]*?RAISE EXCEPTION 'transaction_discount_proof_rejected'/i
    );
    expect(proofRejectionMigrationSql).toMatch(
      /ON CONFLICT \(proof_id\) DO NOTHING[\s\S]*?GET DIAGNOSTICS v_inserted_count = ROW_COUNT/i
    );
    expect(proofRejectionMigrationSql).toMatch(
      /replay\.order_id = NEW\.id[\s\S]*?replay\.merchant_id = NEW\.merchant_id/i
    );
  });

  it('keeps replay cleanup bounded and indexed by consumption time', () => {
    expect(replayBindingMigrationSql).toMatch(
      /CREATE INDEX IF NOT EXISTS transaction_discount_proof_replay_consumed_at_idx[\s\S]*?\(consumed_at\)/i
    );
    expect(proofRejectionMigrationSql).toMatch(
      /DELETE FROM private\.transaction_discount_proof_replay[\s\S]*?consumed_at < pg_catalog\.now\(\) - INTERVAL '1 day'/i
    );
  });
});
