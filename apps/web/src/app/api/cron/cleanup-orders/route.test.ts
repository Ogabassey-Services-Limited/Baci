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
  it('cancels stale Credit Direct BNPL checkout sessions as abandoned orders', () => {
    const sql = readLatestMarkAbandonedOrdersMigrationSql();

    expect(sql).toMatch(markAbandonedOrdersDefinitionPattern);
    expect(sql).toMatch(/SECURITY\s+INVOKER/i);
    expect(sql).toMatch(/hours_threshold\s+<\s+1/i);
    expect(sql).toMatch(/hours_threshold\s+>\s+720/i);
    expect(sql).toContain('invalid_hours_threshold');
    expect(sql).toMatch(/payment_status\s*=\s*'unpaid'/i);
    expect(sql).toMatch(/payment_method\s*=\s*'credit_direct'/i);
    expect(sql).toMatch(/payment_status\s*=\s*'bnpl_pending'/i);
    expect(sql).toMatch(/created_at\s*</i);
    expect(sql).not.toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.mark_abandoned_orders\(integer\)/i
    );

    const appliedSql = readAppliedMarkAbandonedOrdersSql();
    expect(appliedSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.mark_abandoned_orders\(integer\)\s+FROM\s+PUBLIC,\s+anon,\s+authenticated/i
    );
    expect(appliedSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.mark_abandoned_orders\(integer\)\s+TO\s+service_role/i
    );
  });
});
