import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type GithubMigrationSemanticLine,
  githubMigrationSemanticLinesSchema,
  githubMigrationSemanticLinesSchemaForSources,
} from './github-migration-semantic-lines-schema';

function source(index: number, kind: 'primary' | 'corroboration') {
  const version = String(index).padStart(14, '0');
  const name = `migration_${index}`;
  const semanticBytes = [
    `✓ applied:         ${version}  ${name}\n`,
    'Migrations summary: 1 applied, 0 skipped.\n',
  ].join('');
  return {
    kind,
    deploymentRunId: 1000 + index,
    databaseJobId: 2000 + index,
    sanitizedJobLogSha256: createHash('sha256')
      .update(semanticBytes)
      .digest('hex'),
    lines: [
      {
        kind: 'migration' as const,
        marker: '✓ applied:' as const,
        version,
        name,
      },
      {
        kind: 'summary' as const,
        marker: 'Migrations summary:' as const,
        applied: 1,
        skipped: 0,
      },
    ],
  };
}

function validFixture() {
  return {
    schemaVersion: 1,
    sanitizerVersion: 'github-actions-migration-semantic-lines-v1',
    sources: Array.from({ length: 27 }, (_, index) =>
      source(index + 1, index < 25 ? 'primary' : 'corroboration')
    ),
  };
}

function rehash(item: {
  lines: GithubMigrationSemanticLine[];
  sanitizedJobLogSha256: string;
}): void {
  const semanticBytes = item.lines
    .map((line) => {
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
    })
    .join('');
  item.sanitizedJobLogSha256 = createHash('sha256')
    .update(semanticBytes)
    .digest('hex');
}

describe('githubMigrationSemanticLinesSchema', () => {
  it('accepts exactly 25 primary and two corroboration structured sources', () => {
    expect(
      githubMigrationSemanticLinesSchema.parse(validFixture()).sources
    ).toHaveLength(27);
  });

  it('rejects missing, duplicate, and misclassified sources', () => {
    const missing = validFixture();
    missing.sources.pop();
    expect(() => githubMigrationSemanticLinesSchema.parse(missing)).toThrow();

    const duplicate = validFixture();
    duplicate.sources[1] = structuredClone(duplicate.sources[0]);
    expect(() => githubMigrationSemanticLinesSchema.parse(duplicate)).toThrow();

    const misclassified = validFixture();
    misclassified.sources[0].kind = 'corroboration';
    expect(() =>
      githubMigrationSemanticLinesSchema.parse(misclassified)
    ).toThrow();
  });

  it('rejects invalid migration grammar and unsafe summary counts', () => {
    const badVersion = validFixture();
    const migration = badVersion.sources[0].lines[0];
    if (migration.kind !== 'migration') throw new Error('Expected migration');
    migration.version = '20260716';
    expect(() =>
      githubMigrationSemanticLinesSchema.parse(badVersion)
    ).toThrow();

    const badName = validFixture();
    const named = badName.sources[0].lines[0];
    if (named.kind !== 'migration') throw new Error('Expected migration');
    named.name = 'Bad-Name.sql';
    expect(() => githubMigrationSemanticLinesSchema.parse(badName)).toThrow();

    const badCount = validFixture();
    const summary = badCount.sources[0].lines[1];
    if (summary.kind !== 'summary') throw new Error('Expected summary');
    summary.applied = Number.MAX_SAFE_INTEGER + 1;
    expect(() => githubMigrationSemanticLinesSchema.parse(badCount)).toThrow();
  });

  it('rejects multiple, non-terminal, summary-only, and contradictory summaries', () => {
    const multiple = validFixture();
    multiple.sources[0].lines.push(
      structuredClone(multiple.sources[0].lines[1])
    );
    rehash(multiple.sources[0]);

    const nonTerminal = validFixture();
    nonTerminal.sources[0].lines.reverse();
    rehash(nonTerminal.sources[0]);

    const summaryOnly = validFixture();
    const onlySummary = summaryOnly.sources[0].lines[1];
    if (onlySummary.kind !== 'summary') throw new Error('Expected summary');
    onlySummary.applied = 0;
    summaryOnly.sources[0].lines = [onlySummary];
    rehash(summaryOnly.sources[0]);

    const contradictory = validFixture();
    const wrongSummary = contradictory.sources[0].lines[1];
    if (wrongSummary.kind !== 'summary') throw new Error('Expected summary');
    wrongSummary.applied = 0;
    rehash(contradictory.sources[0]);

    for (const fixture of [multiple, nonTerminal, summaryOnly, contradictory]) {
      expect(() => githubMigrationSemanticLinesSchema.parse(fixture)).toThrow();
    }
  });

  it('preserves a summary-less failed-after-applied source', () => {
    const fixture = validFixture();
    fixture.sources[0].lines = [fixture.sources[0].lines[0]];
    rehash(fixture.sources[0]);

    expect(
      githubMigrationSemanticLinesSchema.parse(fixture).sources[0].lines
    ).toHaveLength(1);
  });

  it('rejects unknown fields including the retired raw suffix shape', () => {
    const fixture = validFixture();
    Object.assign(fixture.sources[0].lines[0], { suffix: '.sql' });
    expect(() => githubMigrationSemanticLinesSchema.parse(fixture)).toThrow();
  });

  it('binds the checked fixture to exact Task 2 sources and reconstructed hashes', async () => {
    const fixturesDirectory = path.resolve(import.meta.dirname, '../fixtures');
    const fixture = JSON.parse(
      await readFile(
        path.join(fixturesDirectory, 'github-migration-semantic-lines.json'),
        'utf8'
      )
    );
    const provenance = JSON.parse(
      await readFile(
        path.join(fixturesDirectory, 'production-effect-provenance.json'),
        'utf8'
      )
    ) as {
      evidenceSources: Array<{
        deploymentRunId: number;
        databaseJobId: number;
        sanitizedJobLogSha256: string;
        corroboration?: {
          deploymentRunId: number;
          databaseJobId: number;
          sanitizedJobLogSha256: string;
        };
      }>;
    };
    const bindings = provenance.evidenceSources.flatMap((source) => [
      {
        kind: 'primary' as const,
        deploymentRunId: source.deploymentRunId,
        databaseJobId: source.databaseJobId,
        sanitizedJobLogSha256: source.sanitizedJobLogSha256,
      },
      ...(source.corroboration
        ? [
            {
              kind: 'corroboration' as const,
              deploymentRunId: source.corroboration.deploymentRunId,
              databaseJobId: source.corroboration.databaseJobId,
              sanitizedJobLogSha256: source.corroboration.sanitizedJobLogSha256,
            },
          ]
        : []),
    ]);
    const boundSchema = githubMigrationSemanticLinesSchemaForSources(bindings);

    expect(boundSchema.parse(fixture).sources).toHaveLength(27);

    const wrongSource = structuredClone(fixture);
    wrongSource.sources[0].deploymentRunId = 1;
    expect(() => boundSchema.parse(wrongSource)).toThrow();

    const wrongJob = structuredClone(fixture);
    wrongJob.sources[0].databaseJobId = 1;
    expect(() => boundSchema.parse(wrongJob)).toThrow();

    const wrongKinds = structuredClone(fixture);
    wrongKinds.sources[0].kind = 'corroboration';
    wrongKinds.sources[25].kind = 'primary';
    expect(() => boundSchema.parse(wrongKinds)).toThrow();

    const wrongLine = structuredClone(fixture);
    wrongLine.sources[0].lines[0].name = 'mutated_migration_name';
    expect(() => boundSchema.parse(wrongLine)).toThrow();

    const wrongDigest = structuredClone(fixture);
    wrongDigest.sources[0].sanitizedJobLogSha256 = '0'.repeat(64);
    expect(() => boundSchema.parse(wrongDigest)).toThrow();
  });
});
