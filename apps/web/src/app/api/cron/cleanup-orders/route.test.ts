import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CleanupOrdersRpc = (
  name: string,
  params?: unknown
) => Promise<{ data: unknown; error: unknown }>;

const mocks = vi.hoisted(() => ({
  getCronSecret: vi.fn<() => string | undefined>(() => 'cron-secret'),
  rpc: vi.fn<CleanupOrdersRpc>(),
}));

vi.mock('@/env', () => ({
  getCronSecret: mocks.getCronSecret,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { GET } from './route';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../../../../supabase/migrations'
);
const migrationFilePattern = /^\d{14}.*\.sql$/;
const markAbandonedOrdersDefinitionPattern =
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:(?:"public"|public)\s*\.\s*)?(?:"mark_abandoned_orders"|mark_abandoned_orders)\s*\(/i;
const createPaymentTransactionDefinitionPattern =
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:(?:"public"|public)\s*\.\s*)?(?:"create_payment_transaction"|create_payment_transaction)\s*\(/i;

function createCronRequest(auth = 'Bearer cron-secret') {
  return new NextRequest('http://localhost:3000/api/cron/cleanup-orders', {
    headers: auth ? { authorization: auth } : {},
    method: 'GET',
  });
}

function readMigrationSqlFiles() {
  return readdirSync(migrationsDirectory)
    .filter((file) => migrationFilePattern.test(file))
    .sort()
    .map((fileName) => ({
      fileName,
      sql: readFileSync(resolve(migrationsDirectory, fileName), 'utf8'),
    }));
}

function readLatestMarkAbandonedOrdersMigrationSql() {
  for (const { sql } of readMigrationSqlFiles().toReversed()) {
    if (markAbandonedOrdersDefinitionPattern.test(sql)) {
      return sql;
    }
  }

  throw new Error('No mark_abandoned_orders migration found');
}

function readLatestCreatePaymentTransactionMigrationSql() {
  for (const { sql } of readMigrationSqlFiles().toReversed()) {
    if (createPaymentTransactionDefinitionPattern.test(sql)) {
      return sql;
    }
  }

  throw new Error('No create_payment_transaction migration found');
}

function readAppliedMarkAbandonedOrdersSql() {
  return readMigrationSqlFiles()
    .filter(
      ({ sql }) =>
        markAbandonedOrdersDefinitionPattern.test(sql) ||
        /ON\s+FUNCTION\s+public\.mark_abandoned_orders\(integer\)/i.test(sql)
    )
    .map(({ sql }) => sql)
    .join('\n');
}

describe('GET /api/cron/cleanup-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue('cron-secret');
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await GET(createCronRequest('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const response = await GET(createCronRequest(''));

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns 401 when the cron secret is missing', async () => {
    mocks.getCronSecret.mockReturnValue(undefined);

    const response = await GET(createCronRequest());

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('runs the abandoned order cleanup RPC with the 72-hour threshold', async () => {
    const response = await GET(createCronRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Cleanup job completed successfully',
      success: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('mark_abandoned_orders', {
      hours_threshold: 72,
    });
  });

  it('returns 500 when the cleanup RPC fails', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'database timeout' },
    });

    const response = await GET(createCronRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to clean up orders',
    });
  });
});

describe('mark_abandoned_orders migration contract', () => {
  it('cancels stale BNPL checkout sessions as abandoned orders', () => {
    const sql = readLatestMarkAbandonedOrdersMigrationSql();

    expect(sql).toMatch(markAbandonedOrdersDefinitionPattern);
    expect(sql).toMatch(/SECURITY\s+INVOKER/i);
    expect(sql).toMatch(/hours_threshold\s+<\s+1/i);
    expect(sql).toMatch(/hours_threshold\s+>\s+720/i);
    expect(sql).toContain('invalid_hours_threshold');
    expect(sql).toMatch(/payment_status\s*=\s*'unpaid'/i);
    expect(sql).toMatch(
      /payment_method\s*IN\s*\('credit_direct',\s*'klump'\)/i
    );
    expect(sql).toMatch(
      /payment_status\s+IN\s*\('pending',\s*'bnpl_pending'\)/i
    );
    expect(sql).toMatch(/shipping_status\s*=\s*CASE/i);
    expect(sql).toMatch(/cancelled_at\s*=\s*CASE/i);
    expect(sql).not.toMatch(
      /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.transactions/i
    );
    expect(sql).toMatch(/created_at\s*</i);
    expect(sql).toMatch(/hours_threshold\s*\*\s*interval\s+'1 hour'/i);
    expect(sql).not.toMatch(/hours_threshold\s*\|\|\s*' hours'/i);
    const appliedSql = readAppliedMarkAbandonedOrdersSql();
    expect(appliedSql).toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.mark_abandoned_orders\(\)/i
    );
    expect(appliedSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.mark_abandoned_orders\(integer\)\s+FROM\s+PUBLIC,\s+anon,\s+authenticated/i
    );
    expect(appliedSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.mark_abandoned_orders\(integer\)\s+TO\s+service_role/i
    );
  });
});

describe('create_payment_transaction migration contract', () => {
  it('starts Klump and Credit Direct orders in BNPL pending status', () => {
    const sql = readLatestCreatePaymentTransactionMigrationSql();

    expect(sql).toMatch(createPaymentTransactionDefinitionPattern);
    expect(sql).toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.create_payment_transaction/i
    );
    expect(sql).toMatch(/p_metadata\s+jsonb\s+DEFAULT\s+'\{\}'::jsonb/i);
    expect(sql).toMatch(/v_gateway\s+IN\s*\('klump',\s*'credit_direct'\)/i);
    expect(sql).toMatch(/THEN\s+'bnpl_pending'/i);
    expect(sql).toMatch(/ELSE\s+'pending'/i);
    expect(sql).toMatch(/auth\.uid\(\)/i);
    expect(sql).toMatch(/request\.jwt\.claim\.role/i);
    expect(sql).toMatch(/request\.jwt\.claims/i);
    expect(sql).toMatch(/v_request_role\s+<>\s+'service_role'/i);
    expect(sql).toMatch(/public\.merchants\b/i);
    expect(sql).toMatch(/public\.staff_members\b/i);
    expect(sql).toMatch(/RAISE\s+EXCEPTION\s+'reference_in_use'/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/baci_order_payment:/i);
    expect(sql).toMatch(/hashtextextended\(v_reference,\s*0\)/i);
    expect(sql).toMatch(/COALESCE\(p_metadata,\s*'\{\}'::jsonb\)/i);
    expect(sql).toMatch(/payment_status\s*=\s*v_order_payment_status/i);
    expect(sql).toMatch(/o\.payment_status\s+NOT\s+IN/i);
    expect(sql).toMatch(/'paid'/i);
    expect(sql).toMatch(/'bnpl_approved'/i);
    expect(sql).toMatch(/'cancelled'/i);
    expect(sql).not.toMatch(
      /GRANT\s+ALL\s+ON\s+FUNCTION\s+public\.create_payment_transaction/i
    );
    expect(sql).not.toMatch(
      /GRANT\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+public\.create_payment_transaction[\s\S]*TO\s+anon/i
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_payment_transaction[\s\S]*jsonb[\s\S]*TO[\s\S]*\bauthenticated\b/i
    );
    expect(sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_payment_transaction[\s\S]*jsonb[\s\S]*TO[\s\S]*\bservice_role\b/i
    );
  });
});
