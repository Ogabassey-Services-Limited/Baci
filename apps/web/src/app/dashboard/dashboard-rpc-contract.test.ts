import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../../supabase/migrations'
);

function latestFunctionDefinition(functionName: string): string {
  const marker = `CREATE OR REPLACE FUNCTION "public"."${functionName}"`;
  let latestDefinition = '';

  for (const fileName of readdirSync(migrationsDirectory).sort()) {
    if (!fileName.endsWith('.sql')) {
      continue;
    }

    const sql = readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
    const index = sql.lastIndexOf(marker);
    if (index !== -1) {
      latestDefinition = sql.slice(index);
    }
  }

  return latestDefinition;
}

function ordersQueryBlocks(sql: string): string[] {
  return Array.from(
    sql.matchAll(/FROM orders o[\s\S]*?;/g),
    ([block]) => block
  );
}

describe('dashboard sales RPC contract', () => {
  it('reports dashboard sales metrics from paid current-period orders only', () => {
    const sql = latestFunctionDefinition('get_sales_dashboard_stats');

    const queryBlocks = ordersQueryBlocks(sql);

    expect(queryBlocks).toHaveLength(3);
    for (const block of queryBlocks) {
      expect(block).toContain("o.payment_status = 'paid'");
    }

    expect(sql).toContain(
      "'revenue', jsonb_build_object('value', v_current_revenue"
    );
    expect(sql).toContain(
      "'customers', jsonb_build_object('value', v_current_customers_count"
    );
    expect(sql).toContain(
      "'orders', jsonb_build_object('value', v_current_orders_count"
    );
    expect(sql).not.toContain('v_total_revenue');
    expect(sql).not.toContain('v_total_unique_customers');
    expect(sql).not.toContain('v_total_paid_orders');
    expect(sql).not.toMatch(/FROM orders\s+WHERE merchant_id = p_merchant_id;/);
  });
});
