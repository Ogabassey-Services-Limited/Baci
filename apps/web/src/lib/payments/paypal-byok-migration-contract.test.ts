import { describe, expect, it } from 'vitest';
import { readByokMigration as readMigration } from './read-byok-migration';

describe('PayPal BYOK migration contracts', () => {
  it('atomically serializes both credential-role replacements', () => {
    const sql = readMigration(
      '20260723000013_replace_merchant_payment_credential_pair.sql'
    );

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.replace_merchant_payment_credential_pair'
    );
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
    const lockOffset = sql.indexOf('pg_catalog.pg_advisory_xact_lock');
    const insertOffset = sql.indexOf(
      'INSERT INTO private.merchant_payment_credentials'
    );
    const clientIdOffset = sql.indexOf("'client_id'", insertOffset);
    const secretKeyOffset = sql.indexOf("'secret_key'", insertOffset);
    const conflictOffset = sql.indexOf(
      'ON CONFLICT (merchant_id, provider, credential_role, environment)',
      insertOffset
    );
    expect(lockOffset).toBeLessThan(insertOffset);
    expect(insertOffset).toBeLessThan(clientIdOffset);
    expect(clientIdOffset).toBeLessThan(secretKeyOffset);
    expect(secretKeyOffset).toBeLessThan(conflictOffset);
    expect(sql).toContain(
      'ON CONFLICT (merchant_id, provider, credential_role, environment)'
    );
    expect(sql).toMatch(
      /key_last4,\s+is_active,\s+last_validated_at,\s+last_validation_error,\s+disabled_at,\s+disabled_reason\s*\)/
    );
    expect(
      sql.match(/\btrue,\s+pg_catalog\.now\(\),\s+NULL,\s+NULL,\s+NULL/g)
    ).toHaveLength(2);
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
    const pairSignature = String.raw`public\.replace_merchant_payment_credential_pair\(\s*uuid,\s*text,\s*text,\s*text,\s*smallint,\s*text,\s*text,\s*smallint,\s*text\s*\)`;
    expect(sql).toMatch(
      new RegExp(
        String.raw`GRANT EXECUTE ON FUNCTION\s+${pairSignature}\s+TO service_role`
      )
    );
    for (const role of ['PUBLIC', 'anon', 'authenticated']) {
      expect(sql).toMatch(
        new RegExp(
          String.raw`REVOKE ALL ON FUNCTION\s+${pairSignature}\s+FROM ${role}`
        )
      );
    }
    expect(sql).not.toMatch(
      new RegExp(
        String.raw`GRANT EXECUTE ON FUNCTION\s+${pairSignature}\s+TO (?:anon|authenticated)`
      )
    );
  });

  it('preserves and validates the authoritative settlement foreign key', () => {
    const sql = readMigration(
      '20260723000005_orders_paid_transaction_marker.sql'
    );

    expect(sql).toContain("conrelid = 'public.orders'::regclass");
    expect(sql).toContain("confrelid = 'public.transactions'::regclass");
    expect(sql).toContain("confdeltype = 'a'");
    expect(sql).toContain("a.attname = 'paid_transaction_id'");
    expect(sql).toContain("a.attname = 'id'");
    expect(sql).toContain('FOREIGN KEY (paid_transaction_id)');
    expect(sql).toContain('REFERENCES public.transactions(id)');
    expect(sql).toContain('ON DELETE NO ACTION');
    expect(sql).not.toContain('ON DELETE SET NULL');
    expect(sql).not.toContain('CREATE INDEX');
  });

  it('builds the settlement-marker index concurrently', () => {
    const sql = readMigration(
      '20260723000006_orders_paid_transaction_marker_index.sql'
    );

    expect(sql.startsWith('-- disable-transaction')).toBe(true);
    expect(sql).toContain(
      'DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_paid_transaction_id_next'
    );
    expect(sql).toMatch(
      /CREATE INDEX CONCURRENTLY idx_orders_paid_transaction_id_next\s+ON public\.orders \(paid_transaction_id\)\s+WHERE paid_transaction_id IS NOT NULL;/
    );
    const createNextOffset = sql.indexOf(
      'CREATE INDEX CONCURRENTLY idx_orders_paid_transaction_id_next'
    );
    const dropLiveOffset = sql.indexOf(
      'DROP INDEX CONCURRENTLY IF EXISTS public.idx_orders_paid_transaction_id;'
    );
    const renameOffset = sql.indexOf(
      'ALTER INDEX public.idx_orders_paid_transaction_id_next'
    );
    expect(createNextOffset).toBeGreaterThan(-1);
    expect(createNextOffset).toBeLessThan(dropLiveOffset);
    expect(dropLiveOffset).toBeLessThan(renameOffset);
    expect(sql).toMatch(
      /ALTER INDEX public\.idx_orders_paid_transaction_id_next\s+RENAME TO idx_orders_paid_transaction_id;/
    );
  });

  it('builds the refund-pending index concurrently', () => {
    const statusSql = readMigration(
      '20260723000010_transactions_refund_statuses.sql'
    );
    const indexSql = readMigration(
      '20260723000011_transactions_refund_pending_index.sql'
    );

    expect(statusSql).not.toContain('CREATE INDEX');
    expect(statusSql).toMatch(
      /ADD CONSTRAINT transactions_status_check[\s\S]*NOT VALID;/
    );
    expect(statusSql).toContain(
      'VALIDATE CONSTRAINT transactions_status_check'
    );
    const statusConstraint = statusSql.match(
      /ADD CONSTRAINT transactions_status_check[\s\S]*?CHECK \(([\s\S]*?)\) NOT VALID;/
    )?.[1];
    expect(
      Array.from(
        statusConstraint?.matchAll(/'([^']+)'::text/g) ?? [],
        (m) => m[1]
      )
    ).toEqual([
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelled',
      'refunded',
      'refund_pending',
    ]);
    expect(indexSql.startsWith('-- disable-transaction')).toBe(true);
    expect(indexSql).toContain(
      'DROP INDEX CONCURRENTLY IF EXISTS public.transactions_refund_pending_idx_next'
    );
    expect(indexSql).toMatch(
      /CREATE INDEX CONCURRENTLY transactions_refund_pending_idx_next\s+ON public\.transactions \(updated_at\)\s+WHERE status = 'refund_pending';/
    );
    const createNextOffset = indexSql.indexOf(
      'CREATE INDEX CONCURRENTLY transactions_refund_pending_idx_next'
    );
    const dropLiveOffset = indexSql.indexOf(
      'DROP INDEX CONCURRENTLY IF EXISTS public.transactions_refund_pending_idx;'
    );
    const renameOffset = indexSql.indexOf(
      'ALTER INDEX public.transactions_refund_pending_idx_next'
    );
    expect(createNextOffset).toBeGreaterThan(-1);
    expect(createNextOffset).toBeLessThan(dropLiveOffset);
    expect(dropLiveOffset).toBeLessThan(renameOffset);
    expect(indexSql).toMatch(
      /ALTER INDEX public\.transactions_refund_pending_idx_next\s+RENAME TO transactions_refund_pending_idx;/
    );
  });

  it('preserves the PayPal capture-persist reconciliation review type', () => {
    const sql = readMigration(
      '20260723000012_include_paypal_capture_persist_review_type.sql'
    );

    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS reconciliation_review_issue_type_check'
    );
    const issueTypeConstraint = sql.match(
      /ADD CONSTRAINT reconciliation_review_issue_type_check CHECK \(issue_type IN \(([\s\S]*?)\)\) NOT VALID;/
    )?.[1];
    expect(
      Array.from(issueTypeConstraint?.matchAll(/'([^']+)'/g) ?? [], (m) => m[1])
    ).toEqual([
      'payment_match_ambiguous',
      'payment_match_zero_candidates',
      'manage_stock_cancellation_held',
      'tax_basis_unclassified',
      'tax_basis_inconsistent_total',
      'wallet_dva_order_alias_conflict',
      'customer_savings_auto_debit_allocation_failed',
      'wallet_order_funding_ambiguous',
      'wallet_order_funding_conflict',
      'wallet_order_funding_finalize_failed',
      'payment_received_after_cancellation',
      'payment_received_after_refund',
      'serialized_inventory_confirmation_failed',
      'merchant_settlement_failed',
      'gateway_payment_wedge_requires_review',
      // These two were added by main's Credit Direct + cancellation migrations;
      // since this migration is dated after main's tail it MUST preserve them, or
      // the validated ADD CONSTRAINT rejects existing prod rows and aborts deploy.
      'credit_direct_confirmation_missing',
      'order_cancellation_refund_requires_review',
      'paypal_capture_persist_failed',
    ]);
    expect(sql).toMatch(
      /ADD CONSTRAINT reconciliation_review_issue_type_check[\s\S]*NOT VALID;/
    );
    expect(sql).toContain(
      'VALIDATE CONSTRAINT reconciliation_review_issue_type_check'
    );
  });
});
