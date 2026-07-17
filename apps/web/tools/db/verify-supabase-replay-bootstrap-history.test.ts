import { describe, expect, it, vi } from 'vitest';
import type {
  ReplayCommand,
  ReplaySource,
} from './supabase-history-replay-types';
import { verifySupabaseReplayBootstrapHistory } from './verify-supabase-replay-bootstrap-history';

const databaseUrl = 'postgresql://postgres:secret@127.0.0.1:41001/postgres';
const expectedSources: ReplaySource[] = [
  {
    receiptId: 'base:1',
    repositoryPath: 'supabase/migrations/20260101000000_first.sql',
    sha256: '1'.repeat(64),
  },
  {
    receiptId: 'base:2',
    repositoryPath: 'supabase/migrations/20260102000000_second.sql',
    sha256: '2'.repeat(64),
  },
];
const validRows = [
  { name: 'first', version: '20260101000000' },
  { name: 'second', version: '20260102000000' },
];

function commandReturning(value: unknown): ReplayCommand {
  return vi.fn(async () => ({
    stderr: '',
    stdout: `${JSON.stringify(value)}\n`,
  }));
}

describe('verifySupabaseReplayBootstrapHistory', () => {
  it('accepts the exact ordered bootstrap ledger without exposing the URL', async () => {
    const runCommand = commandReturning(validRows);

    await expect(
      verifySupabaseReplayBootstrapHistory({
        databaseUrl,
        expectedSources,
        psqlBin: '/opt/homebrew/opt/libpq/bin/psql',
        runCommand,
      })
    ).resolves.toBeUndefined();

    expect(runCommand).toHaveBeenCalledOnce();
    const [command, args, options] = vi.mocked(runCommand).mock.calls[0] ?? [];
    expect(command).toBe('/opt/homebrew/opt/libpq/bin/psql');
    expect(args).toEqual(['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-At']);
    expect(args?.join(' ')).not.toContain(databaseUrl);
    expect(options?.input).toContain(
      'FROM supabase_migrations.schema_migrations'
    );
    expect(options?.input).not.toContain(databaseUrl);
    expect(options?.env).toMatchObject({
      PGCONNECT_TIMEOUT: '5',
      PGDATABASE: 'postgres',
      PGHOST: '127.0.0.1',
      PGPASSWORD: 'secret',
      PGPORT: '41001',
      PGUSER: 'postgres',
      PGOPTIONS: '-c default_transaction_read_only=on',
    });
  });

  it.each([
    ['missing', [validRows[0]]],
    ['extra', [...validRows, { name: 'third', version: '20260103000000' }]],
    ['duplicate', [validRows[0], validRows[0]]],
    ['renamed', [validRows[0], { ...validRows[1], name: 'changed' }]],
    ['reordered', [validRows[1], validRows[0]]],
  ])('rejects a %s bootstrap ledger row', async (_case, rows) => {
    await expect(
      verifySupabaseReplayBootstrapHistory({
        databaseUrl,
        expectedSources,
        psqlBin: 'psql',
        runCommand: commandReturning(rows),
      })
    ).rejects.toThrow(/^Supabase replay bootstrap history mismatch$/);
  });

  it.each([
    ['invalid JSON', 'not-json'],
    ['non-array JSON', { name: 'first', version: '20260101000000' }],
    ['an unexpected key', [{ ...validRows[0], statements: [] }, validRows[1]]],
    [
      'a non-string field',
      [validRows[0], { name: 2, version: '20260102000000' }],
    ],
  ])('rejects %s without echoing database output', async (_case, output) => {
    const runCommand: ReplayCommand = vi.fn(async () => ({
      stderr: '',
      stdout: typeof output === 'string' ? output : JSON.stringify(output),
    }));

    await expect(
      verifySupabaseReplayBootstrapHistory({
        databaseUrl,
        expectedSources,
        psqlBin: 'psql',
        runCommand,
      })
    ).rejects.toThrow(/^Supabase replay bootstrap history is invalid$/);
  });

  it('rejects a malformed expected bootstrap source', async () => {
    await expect(
      verifySupabaseReplayBootstrapHistory({
        databaseUrl,
        expectedSources: [
          {
            ...expectedSources[0],
            repositoryPath: 'supabase/migrations/not-versioned.sql',
          },
        ],
        psqlBin: 'psql',
        runCommand: commandReturning([]),
      })
    ).rejects.toThrow(/^Supabase replay bootstrap source is invalid$/);
  });
});
