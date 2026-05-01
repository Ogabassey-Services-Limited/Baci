import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AGENTIC_DVA_GATEWAY_REFERENCE_MIGRATION } from '@/config/agentic-migration-files';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

describe('agentic Paystack DVA database contract', () => {
  it('guards agentic gateway references with a database unique index', () => {
    const migrationPath = resolve(
      currentDirectory,
      '../../../../../supabase/migrations',
      AGENTIC_DVA_GATEWAY_REFERENCE_MIGRATION
    );
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
    expect(sql).toContain('transactions_agentic_gateway_reference_unique_idx');
    expect(sql).toContain('ON public.transactions (gateway_reference)');
    expect(sql).toContain("gateway = 'paystack'");
    expect(sql).toContain(
      "(metadata->>'transaction_type') = 'agentic_checkout_payment'"
    );
  });
});
