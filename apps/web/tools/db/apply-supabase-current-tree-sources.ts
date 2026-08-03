import { applySupabaseReplaySql } from './apply-supabase-replay-sql';
import type {
  FrozenReplaySource,
  ReplaySource,
} from './supabase-history-replay-types';

type CurrentTreeSourceOptions = {
  apply: (sqlPath: string) => Promise<unknown>;
  materializeSource: (
    repositoryRoot: string,
    workdir: string,
    source: ReplaySource,
    ordinal: number
  ) => Promise<string>;
  pendingSources: readonly FrozenReplaySource[];
  postReplaySources: readonly ReplaySource[];
  repositoryRoot: string;
  startingOrdinal: number;
  workdir: string;
};

const replaySourceReplacements = new Map([
  [
    'supabase/migrations/20260727220050_shipment_tracking_realtime_broadcast.sql',
    'supabase/migrations/20260803000600_repair_gigl_tracking_realtime_broadcast.sql',
  ],
]);

export async function applySupabaseCurrentTreeSources(
  options: CurrentTreeSourceOptions
): Promise<void> {
  const sources: ReplaySource[] = [
    ...options.postReplaySources,
    ...options.pendingSources.map((source) => ({
      ...source,
      receiptId: `pending:${source.repositoryPath}`,
    })),
  ];

  const appliedPaths = new Set<string>();
  let ordinal = options.startingOrdinal;
  for (const source of sources) {
    const replacementPath = replaySourceReplacements.get(source.repositoryPath);
    if (replacementPath) {
      const replacement = sources.find(
        ({ repositoryPath }) => repositoryPath === replacementPath
      );
      if (!replacement) {
        throw new Error(
          `Missing replay replacement source: ${replacementPath}`
        );
      }
      if (appliedPaths.has(replacement.repositoryPath)) continue;
      const sqlPath = await options.materializeSource(
        options.repositoryRoot,
        options.workdir,
        replacement,
        ordinal
      );
      await applySupabaseReplaySql(options.apply, {
        kind: 'migration',
        ordinal,
        sqlPath,
      });
      appliedPaths.add(replacement.repositoryPath);
      ordinal += 1;
      continue;
    }
    if (appliedPaths.has(source.repositoryPath)) continue;
    const sqlPath = await options.materializeSource(
      options.repositoryRoot,
      options.workdir,
      source,
      ordinal
    );
    await applySupabaseReplaySql(options.apply, {
      kind: 'migration',
      ordinal,
      sqlPath,
    });
    appliedPaths.add(source.repositoryPath);
    ordinal += 1;
  }
}
