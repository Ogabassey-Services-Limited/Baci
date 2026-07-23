import { createHash } from 'node:crypto';
import type { GithubMigrationSemanticLine } from './schemas/github-migration-semantic-lines-schema';

const MARKERS = [
  '→ applying:',
  '✓ applied:',
  '✓ already applied:',
  'Migrations summary:',
] as const;

type SourceIdentity = {
  deploymentRunId: number;
  databaseJobId: number;
};

function fail(identity: SourceIdentity, code: string): never {
  throw new Error(
    `GitHub migration semantic source ${identity.deploymentRunId}:${identity.databaseJobId} invalid ${code}`
  );
}

function markerOffsets(line: string): number[] {
  const offsets: number[] = [];
  for (const marker of MARKERS) {
    let offset = line.indexOf(marker);
    while (offset !== -1) {
      offsets.push(offset);
      offset = line.indexOf(marker, offset + marker.length);
    }
  }
  return offsets;
}

function migrationLine(
  marker: (typeof MARKERS)[0 | 1 | 2],
  match: RegExpMatchArray,
  identity: SourceIdentity
): GithubMigrationSemanticLine {
  const version = match[1];
  const name = match[2];
  if (!version || !name) fail(identity, 'migration_capture');
  return { kind: 'migration', marker, version, name };
}

function parseSemanticLine(
  semantic: string,
  identity: SourceIdentity
): GithubMigrationSemanticLine {
  const applying = semantic.match(
    /^→ applying: {8}([0-9]{14}) {2}([a-z0-9_]+)$/
  );
  if (applying) return migrationLine('→ applying:', applying, identity);
  const applied = semantic.match(/^✓ applied: {9}([0-9]{14}) {2}([a-z0-9_]+)$/);
  if (applied) return migrationLine('✓ applied:', applied, identity);
  const alreadyApplied = semantic.match(
    /^✓ already applied: ([0-9]{14}) {2}([a-z0-9_]+)$/
  );
  if (alreadyApplied) {
    return migrationLine('✓ already applied:', alreadyApplied, identity);
  }
  const summary = semantic.match(
    /^Migrations summary: ([0-9]+) applied, ([0-9]+) skipped\.$/
  );
  if (!summary) fail(identity, 'semantic_line_grammar');
  const appliedCount = Number(summary[1]);
  const skippedCount = Number(summary[2]);
  if (
    !Number.isSafeInteger(appliedCount) ||
    !Number.isSafeInteger(skippedCount)
  ) {
    fail(identity, 'summary_integer');
  }
  return {
    kind: 'summary',
    marker: 'Migrations summary:',
    applied: appliedCount,
    skipped: skippedCount,
  };
}

function reconstruct(line: GithubMigrationSemanticLine): string {
  if (line.kind === 'summary') {
    return `Migrations summary: ${line.applied} applied, ${line.skipped} skipped.\n`;
  }
  const spaces =
    line.marker === '→ applying:'
      ? '        '
      : line.marker === '✓ applied:'
        ? '         '
        : ' ';
  return `${line.marker}${spaces}${line.version}  ${line.name}\n`;
}

export function extractGithubMigrationSemanticLines(
  rawLog: string,
  identity: SourceIdentity
): {
  lines: GithubMigrationSemanticLine[];
  semanticBytes: string;
  sanitizedJobLogSha256: string;
} {
  const lines: GithubMigrationSemanticLine[] = [];
  for (const physicalLine of rawLog.split('\n')) {
    const offsets = markerOffsets(physicalLine);
    if (offsets.length === 0) continue;
    if (offsets.length !== 1) fail(identity, 'ambiguous_marker');
    const semantic = physicalLine.slice(offsets[0]);
    lines.push(parseSemanticLine(semantic, identity));
  }
  if (lines.length === 0) fail(identity, 'zero_lines');
  const semanticBytes = lines.map(reconstruct).join('');
  return {
    lines,
    semanticBytes,
    sanitizedJobLogSha256: createHash('sha256')
      .update(semanticBytes)
      .digest('hex'),
  };
}
