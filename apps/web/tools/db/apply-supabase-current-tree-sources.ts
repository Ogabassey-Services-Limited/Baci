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

  for (const [index, source] of sources.entries()) {
    const ordinal = options.startingOrdinal + index;
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
  }
}
