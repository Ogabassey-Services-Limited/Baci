import type { GithubMigrationSemanticLine } from './schemas/github-migration-semantic-lines-schema';

export function parseGithubMigrationJobLog(
  lines: readonly GithubMigrationSemanticLine[]
): {
  appliedEntries: Array<{
    logOrdinal: number;
    version: string;
    name: string;
  }>;
  alreadyAppliedEntries: Array<{ version: string; name: string }>;
  summary: { applied: number; skipped: number } | null;
} {
  const appliedEntries: Array<{
    logOrdinal: number;
    version: string;
    name: string;
  }> = [];
  const alreadyAppliedEntries: Array<{ version: string; name: string }> = [];
  let summary: { applied: number; skipped: number } | null = null;

  for (const line of lines) {
    if (summary)
      throw new Error('Migration semantic log has line after summary');
    if (line.kind === 'summary') {
      summary = { applied: line.applied, skipped: line.skipped };
      continue;
    }
    if (line.marker === '✓ applied:') {
      appliedEntries.push({
        logOrdinal: appliedEntries.length + 1,
        version: line.version,
        name: line.name,
      });
    } else if (line.marker === '✓ already applied:') {
      alreadyAppliedEntries.push({ version: line.version, name: line.name });
    }
  }

  if (
    summary &&
    (summary.applied !== appliedEntries.length ||
      summary.skipped !== alreadyAppliedEntries.length)
  ) {
    throw new Error('Migration semantic log summary count mismatch');
  }
  return { appliedEntries, alreadyAppliedEntries, summary };
}
