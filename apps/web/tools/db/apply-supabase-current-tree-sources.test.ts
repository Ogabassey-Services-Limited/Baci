import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { applySupabaseCurrentTreeSources } from './apply-supabase-current-tree-sources';

const historicalPath =
  'supabase/migrations/20260727220050_shipment_tracking_realtime_broadcast.sql';
const repairPath =
  'supabase/migrations/20260803000600_repair_gigl_tracking_realtime_broadcast.sql';
const historicalSha256 =
  '89b2dafdf9de92770d8a20151444a6c34602f78cb83bcc79cb20ed3ea9c21b65';
const retryHistoricalPath =
  'supabase/migrations/20260801141800_harden_gigl_tracking_retry_edges.sql';
const retryRepairPath =
  'supabase/migrations/20260803000700_repair_gigl_tracking_retry_edges.sql';
const retryHistoricalSha256 =
  '35bcfb114ccfdadbbb44f69b21b53dd91b8df7a9eaa875f364e3d22b354801d1';

describe('applySupabaseCurrentTreeSources', () => {
  it('materializes verified post-replay and pending sources in suffix order', async () => {
    const materializeSource = vi.fn(
      async (
        _root: string,
        _workdir: string,
        source: { repositoryPath: string },
        ordinal: number
      ) => `/owned/sql/${ordinal}-${source.repositoryPath.split('/').at(-1)}`
    );
    const apply = vi.fn(async () => undefined);

    await applySupabaseCurrentTreeSources({
      apply,
      materializeSource,
      readSource: async () => Buffer.from(''),
      pendingSources: [
        {
          repositoryPath: 'supabase/migrations/00000000000129_pending.sql',
          sha256: '9'.repeat(64),
        },
      ],
      postReplaySources: [
        {
          receiptId: 'post-replay:supabase/migrations/00000000000128_post.sql',
          repositoryPath: 'supabase/migrations/00000000000128_post.sql',
          sha256: '8'.repeat(64),
        },
      ],
      repositoryRoot: '/repository',
      startingOrdinal: 128,
      workdir: '/owned',
    });

    expect(materializeSource.mock.calls.map((call) => call.slice(2))).toEqual([
      [
        expect.objectContaining({
          receiptId: 'post-replay:supabase/migrations/00000000000128_post.sql',
        }),
        128,
      ],
      [
        expect.objectContaining({
          receiptId: 'pending:supabase/migrations/00000000000129_pending.sql',
        }),
        129,
      ],
    ]);
    expect(apply.mock.calls).toEqual([
      ['/owned/sql/128-00000000000128_post.sql'],
      ['/owned/sql/129-00000000000129_pending.sql'],
    ]);
  });

  it('reports the exact suffix ordinal when application fails', async () => {
    const apply = vi.fn(async () => {
      throw new Error('psql failed: non-zero-exit (line=7,sqlstate=42501)');
    });

    await expect(
      applySupabaseCurrentTreeSources({
        apply,
        materializeSource: async () => '/owned/sql/129-pending.sql',
        readSource: async () => Buffer.from(''),
        pendingSources: [
          {
            repositoryPath: 'supabase/migrations/00000000000129_pending.sql',
            sha256: '9'.repeat(64),
          },
        ],
        postReplaySources: [],
        repositoryRoot: '/repository',
        startingOrdinal: 129,
        workdir: '/owned',
      })
    ).rejects.toThrow(
      /^Replay migration application failed at ordinal 129: non-zero-exit \(line=7,sqlstate=42501\)$/
    );
  });

  it('replays the failed historical source through its append-only repair', async () => {
    const materializeSource = vi.fn(
      async (
        _root: string,
        _workdir: string,
        source: { repositoryPath: string },
        ordinal: number
      ) => `/owned/sql/${ordinal}-${source.repositoryPath.split('/').at(-1)}`
    );
    const apply = vi.fn(async () => undefined);
    await applySupabaseCurrentTreeSources({
      apply,
      materializeSource,
      readSource: async () =>
        readFile(
          path.resolve(
            import.meta.dirname,
            '../../../../supabase/migrations',
            path.basename(historicalPath)
          )
        ),
      pendingSources: [
        { repositoryPath: historicalPath, sha256: historicalSha256 },
        { repositoryPath: repairPath, sha256: 'b'.repeat(64) },
      ],
      postReplaySources: [],
      repositoryRoot: '/repository',
      startingOrdinal: 129,
      workdir: '/owned',
    });

    expect(materializeSource.mock.calls.map((call) => call.slice(2))).toEqual([
      [expect.objectContaining({ repositoryPath: repairPath }), 129],
    ]);
    expect(apply).toHaveBeenCalledWith(
      `/owned/sql/129-${repairPath.split('/').at(-1)}`
    );
  });

  it('rejects a drifted historical source before applying its repair', async () => {
    const materializeSource = vi.fn(async () => '/owned/sql/129-repair.sql');
    const apply = vi.fn(async () => undefined);

    await expect(
      applySupabaseCurrentTreeSources({
        apply,
        materializeSource,
        readSource: async () => Buffer.from('drifted historical source'),
        pendingSources: [
          { repositoryPath: historicalPath, sha256: historicalSha256 },
          { repositoryPath: repairPath, sha256: 'b'.repeat(64) },
        ],
        postReplaySources: [],
        repositoryRoot: '/repository',
        startingOrdinal: 129,
        workdir: '/owned',
      })
    ).rejects.toThrow(/^Replay source hash mismatch$/);

    expect(materializeSource).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it('replays the failed GIGL retry source through its append-only repair', async () => {
    const materializeSource = vi.fn(
      async (
        _root: string,
        _workdir: string,
        source: { repositoryPath: string },
        ordinal: number
      ) => `/owned/sql/${ordinal}-${source.repositoryPath.split('/').at(-1)}`
    );
    const apply = vi.fn(async () => undefined);

    await applySupabaseCurrentTreeSources({
      apply,
      materializeSource,
      readSource: async () =>
        readFile(
          path.resolve(
            import.meta.dirname,
            '../../../../supabase/migrations',
            path.basename(retryHistoricalPath)
          )
        ),
      pendingSources: [
        { repositoryPath: retryHistoricalPath, sha256: retryHistoricalSha256 },
        { repositoryPath: retryRepairPath, sha256: 'c'.repeat(64) },
      ],
      postReplaySources: [],
      repositoryRoot: '/repository',
      startingOrdinal: 129,
      workdir: '/owned',
    });

    expect(materializeSource.mock.calls.map((call) => call.slice(2))).toEqual([
      [expect.objectContaining({ repositoryPath: retryRepairPath }), 129],
    ]);
    expect(apply).toHaveBeenCalledWith(
      `/owned/sql/129-${retryRepairPath.split('/').at(-1)}`
    );
  });
});
