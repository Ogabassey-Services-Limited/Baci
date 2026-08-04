import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { applySupabaseCurrentTreeSources } from './apply-supabase-current-tree-sources';

const repairCases = [
  {
    label: 'GIGL Realtime broadcast',
    historicalPath:
      'supabase/migrations/20260727220050_shipment_tracking_realtime_broadcast.sql',
    historicalSha256:
      '89b2dafdf9de92770d8a20151444a6c34602f78cb83bcc79cb20ed3ea9c21b65',
    repairPath:
      'supabase/migrations/20260803000600_repair_gigl_tracking_realtime_broadcast.sql',
    ordinal: 129,
  },
  {
    label: 'GIGL retry edges',
    historicalPath:
      'supabase/migrations/20260801141800_harden_gigl_tracking_retry_edges.sql',
    historicalSha256:
      '35bcfb114ccfdadbbb44f69b21b53dd91b8df7a9eaa875f364e3d22b354801d1',
    repairPath:
      'supabase/migrations/20260803000700_repair_gigl_tracking_retry_edges.sql',
    ordinal: 129,
  },
  {
    label: 'GIGL failed-event recovery scope',
    historicalPath:
      'supabase/migrations/20260801141900_scope_gigl_recovery_to_failed_event.sql',
    historicalSha256:
      '972030071dbeea262fdd1ccc20f4f62c07c90299d00e5fd70335617c4dd9a91d',
    repairPath:
      'supabase/migrations/20260804000100_repair_gigl_failed_event_recovery_scope.sql',
    ordinal: 129,
  },
  {
    label: 'GIGL notification recovery edges',
    historicalPath:
      'supabase/migrations/20260801142000_harden_gigl_notification_recovery_edges.sql',
    historicalSha256:
      'b373ae3f70d7311004e7e4400c2b3a3c8534300e82ee01c2c9e0d3df2680b81e',
    repairPath:
      'supabase/migrations/20260804000400_repair_gigl_notification_terminality_cardinality.sql',
    ordinal: 129,
  },
  {
    label: 'GIGL manual failure status scope',
    historicalPath:
      'supabase/migrations/20260801142100_preserve_manual_gigl_failures_after_unknown_scans.sql',
    historicalSha256:
      'f97c32889ae2e733d881bd7d6672cd91337936326f55e205d717bb972398ea73',
    repairPath:
      'supabase/migrations/20260804000300_repair_gigl_manual_failure_status_scope.sql',
    ordinal: 129,
  },
  {
    label: 'GIGL monitor backfill join',
    historicalPath:
      'supabase/migrations/20260801142200_cleanup_unowned_gigl_monitor_backfill.sql',
    historicalSha256:
      '605a0d48a4f116e67ee626ff173b66c6c80cefa77ad606a3813aa1ea6deda62a',
    repairPath:
      'supabase/migrations/20260804000500_repair_gigl_monitor_backfill_join.sql',
    ordinal: 129,
  },
] as const;

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

  it.each(
    repairCases
  )('replays the $label source through its append-only repair', async ({
    historicalPath,
    historicalSha256,
    repairPath,
    ordinal,
  }) => {
    const materializeSource = vi.fn(
      async (
        _root: string,
        _workdir: string,
        source: { repositoryPath: string },
        materializeOrdinal: number
      ) =>
        `/owned/sql/${materializeOrdinal}-${source.repositoryPath.split('/').at(-1)}`
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
      startingOrdinal: ordinal,
      workdir: '/owned',
    });

    expect(materializeSource.mock.calls.map((call) => call.slice(2))).toEqual([
      [expect.objectContaining({ repositoryPath: repairPath }), ordinal],
    ]);
    expect(apply).toHaveBeenCalledWith(
      `/owned/sql/${ordinal}-${repairPath.split('/').at(-1)}`
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
          {
            repositoryPath: repairCases[0].historicalPath,
            sha256: repairCases[0].historicalSha256,
          },
          { repositoryPath: repairCases[0].repairPath, sha256: 'b'.repeat(64) },
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

  it('skips the superseded GIGL recovery repair after its successor is applied', async () => {
    const historicalPath =
      'supabase/migrations/20260801142000_harden_gigl_notification_recovery_edges.sql';
    const successorPath =
      'supabase/migrations/20260804000400_repair_gigl_notification_terminality_cardinality.sql';
    const supersededPath =
      'supabase/migrations/20260804000200_repair_gigl_notification_recovery_edges.sql';
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
        {
          repositoryPath: historicalPath,
          sha256:
            'b373ae3f70d7311004e7e4400c2b3a3c8534300e82ee01c2c9e0d3df2680b81e',
        },
        { repositoryPath: supersededPath, sha256: 'a'.repeat(64) },
        { repositoryPath: successorPath, sha256: 'b'.repeat(64) },
      ],
      postReplaySources: [],
      repositoryRoot: '/repository',
      startingOrdinal: 129,
      workdir: '/owned',
    });

    expect(materializeSource.mock.calls.map((call) => call.slice(2))).toEqual([
      [expect.objectContaining({ repositoryPath: successorPath }), 129],
    ]);
    expect(apply).toHaveBeenCalledWith(
      `/owned/sql/129-${successorPath.split('/').at(-1)}`
    );
  });

  it('fails closed when a superseded repair reaches replay before its successor', async () => {
    await expect(
      applySupabaseCurrentTreeSources({
        apply: async () => undefined,
        materializeSource: async () => '/owned/sql/129-superseded.sql',
        readSource: async () => Buffer.from(''),
        pendingSources: [
          {
            repositoryPath:
              'supabase/migrations/20260804000200_repair_gigl_notification_recovery_edges.sql',
            sha256: 'a'.repeat(64),
          },
        ],
        postReplaySources: [],
        repositoryRoot: '/repository',
        startingOrdinal: 129,
        workdir: '/owned',
      })
    ).rejects.toThrow(
      'Superseded replay source requires its replacement to be applied first'
    );
  });
});
