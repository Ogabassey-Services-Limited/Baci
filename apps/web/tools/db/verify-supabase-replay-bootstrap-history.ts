import type {
  ReplayCommand,
  ReplaySource,
} from './supabase-history-replay-types';
import { createSupabaseReplayDatabaseEnvironment } from './supabase-replay-contract';

const BOOTSTRAP_SOURCE_PATTERN =
  /^supabase\/migrations\/(\d{14})_([a-z0-9_]+)\.sql$/;
const BOOTSTRAP_HISTORY_QUERY = `
SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'name', name::text,
      'version', version::text
    )
    ORDER BY version::text, name::text
  ),
  '[]'::jsonb
)::text
FROM supabase_migrations.schema_migrations;
`;

type BootstrapHistoryRow = {
  name: string;
  version: string;
};

function expectedRows(sources: readonly ReplaySource[]): BootstrapHistoryRow[] {
  return sources.map(({ repositoryPath }) => {
    const match = BOOTSTRAP_SOURCE_PATTERN.exec(repositoryPath);
    if (!match) {
      throw new Error('Supabase replay bootstrap source is invalid');
    }
    return {
      name: match[2] as string,
      version: match[1] as string,
    };
  });
}

function parseRows(output: string): BootstrapHistoryRow[] {
  try {
    const parsed: unknown = JSON.parse(output);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed.map((row: unknown) => {
      if (
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        Object.keys(row).sort().join(',') !== 'name,version'
      ) {
        throw new Error();
      }
      const candidate = row as Record<string, unknown>;
      if (
        typeof candidate.name !== 'string' ||
        typeof candidate.version !== 'string'
      ) {
        throw new Error();
      }
      return {
        name: candidate.name,
        version: candidate.version,
      };
    });
  } catch {
    throw new Error('Supabase replay bootstrap history is invalid');
  }
}

export async function verifySupabaseReplayBootstrapHistory(options: {
  databaseUrl: string;
  expectedSources: readonly ReplaySource[];
  psqlBin: string;
  runCommand: ReplayCommand;
}): Promise<void> {
  const expected = expectedRows(options.expectedSources);
  const environment = createSupabaseReplayDatabaseEnvironment(
    options.databaseUrl
  );
  const output = (
    await options.runCommand(
      options.psqlBin,
      ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-At'],
      {
        env: {
          ...environment,
          PGOPTIONS: '-c default_transaction_read_only=on',
        },
        input: BOOTSTRAP_HISTORY_QUERY,
      }
    )
  ).stdout.trim();
  const actual = parseRows(output);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Supabase replay bootstrap history mismatch');
  }
}
