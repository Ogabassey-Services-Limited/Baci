import { describe, expect, it } from 'vitest';
import { parseGithubMigrationJobLog } from './parse-github-migration-job-log';
import type { GithubMigrationSemanticLine } from './schemas/github-migration-semantic-lines-schema';

const migration = (
  marker: '→ applying:' | '✓ applied:' | '✓ already applied:',
  version: string,
  name: string
): GithubMigrationSemanticLine => ({
  kind: 'migration',
  marker,
  version,
  name,
});

describe('parseGithubMigrationJobLog', () => {
  it('numbers only successful application entries in physical order', () => {
    const result = parseGithubMigrationJobLog([
      migration('→ applying:', '20260714100000', 'first'),
      migration('✓ applied:', '20260714100000', 'first'),
      migration('✓ already applied:', '20260714110000', 'skipped'),
      migration('→ applying:', '20260714120000', 'second'),
      migration('✓ applied:', '20260714120000', 'second'),
      {
        kind: 'summary',
        marker: 'Migrations summary:',
        applied: 2,
        skipped: 1,
      },
    ]);

    expect(result.appliedEntries).toEqual([
      { logOrdinal: 1, version: '20260714100000', name: 'first' },
      { logOrdinal: 2, version: '20260714120000', name: 'second' },
    ]);
    expect(result.alreadyAppliedEntries).toEqual([
      { version: '20260714110000', name: 'skipped' },
    ]);
    expect(result.summary).toEqual({ applied: 2, skipped: 1 });
  });

  it('allows a failed-after-apply log with no summary', () => {
    expect(
      parseGithubMigrationJobLog([
        migration('✓ applied:', '20260714100000', 'applied_before_failure'),
      ])
    ).toEqual({
      appliedEntries: [
        {
          logOrdinal: 1,
          version: '20260714100000',
          name: 'applied_before_failure',
        },
      ],
      alreadyAppliedEntries: [],
      summary: null,
    });
  });

  it('rejects duplicate or count-inconsistent summaries', () => {
    const summary: GithubMigrationSemanticLine = {
      kind: 'summary',
      marker: 'Migrations summary:',
      applied: 0,
      skipped: 0,
    };
    expect(() => parseGithubMigrationJobLog([summary, summary])).toThrow(
      /summary/i
    );
    expect(() =>
      parseGithubMigrationJobLog([
        migration('✓ applied:', '20260714100000', 'one'),
        summary,
      ])
    ).toThrow(/summary/i);
  });

  it.each([
    migration('→ applying:', '20260714100000', 'applying'),
    migration('✓ applied:', '20260714100000', 'applied'),
    migration('✓ already applied:', '20260714100000', 'already_applied'),
    {
      kind: 'summary' as const,
      marker: 'Migrations summary:' as const,
      applied: 0,
      skipped: 0,
    },
  ])('rejects every semantic line after a summary', (trailingLine) => {
    expect(() =>
      parseGithubMigrationJobLog([
        {
          kind: 'summary',
          marker: 'Migrations summary:',
          applied: 0,
          skipped: 0,
        },
        trailingLine,
      ])
    ).toThrow(/summary/i);
  });
});
