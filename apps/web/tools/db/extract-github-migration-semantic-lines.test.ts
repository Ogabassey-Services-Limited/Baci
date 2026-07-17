import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { extractGithubMigrationSemanticLines } from './extract-github-migration-semantic-lines';

const identity = { deploymentRunId: 123, databaseJobId: 456 };
const semanticLog =
  '→ applying:        20260714220000  quiz_event_lifecycle_followup\n' +
  '✓ applied:         20260714220000  quiz_event_lifecycle_followup\n' +
  '✓ already applied: 20260714225500  release_wallet_credit_push\n' +
  'Migrations summary: 1 applied, 1 skipped.\n';

describe('extractGithubMigrationSemanticLines', () => {
  it('reconstructs exact semantic bytes from API and gh transport prefixes', () => {
    const api = extractGithubMigrationSemanticLines(
      semanticLog
        .split('\n')
        .filter(Boolean)
        .map((line) => `2026-07-15T00:00:00.1234567Z ${line}`)
        .join('\n'),
      identity
    );
    const cli = extractGithubMigrationSemanticLines(
      semanticLog
        .split('\n')
        .filter(Boolean)
        .map(
          (line) => `database\tApply migrations\t2026-07-15T00:00:00Z ${line}`
        )
        .join('\n'),
      identity
    );

    expect(api.lines).toEqual(cli.lines);
    expect(
      extractGithubMigrationSemanticLines(
        `\uFEFFignored transport\n\u001B[32m${semanticLog}`,
        identity
      ).lines
    ).toEqual(api.lines);
    expect(api.semanticBytes).toBe(semanticLog);
    expect(api.sanitizedJobLogSha256).toBe(
      createHash('sha256').update(semanticLog).digest('hex')
    );
  });

  it('ignores physical lines with no reviewed marker', () => {
    const result = extractGithubMigrationSemanticLines(
      `setup output\n${semanticLog}cleanup output`,
      identity
    );
    expect(result.lines).toHaveLength(4);
  });

  it('rejects CRLF transport instead of normalizing evidence bytes', () => {
    expect(() =>
      extractGithubMigrationSemanticLines(
        semanticLog.replaceAll('\n', '\r\n'),
        identity
      )
    ).toThrow(/123:456/);
  });

  it.each([
    '→ applying:       20260714220000  quiz_event_lifecycle_followup',
    '→ applying:         20260714220000  quiz_event_lifecycle_followup',
    '✓ applied:        20260714220000  quiz_event_lifecycle_followup',
    '✓ applied:          20260714220000  quiz_event_lifecycle_followup',
    '✓ already applied:  20260714225500  release_wallet_credit_push',
    '✓ applied:         20260714220000_quiz_event_lifecycle_followup',
    '✓ applied:         20260714220000  quiz_event_lifecycle_followup.sql',
    '✓ applied:         20260714220000  Bad-Name',
    '✓ applied:         2026071422000  quiz_event_lifecycle_followup',
    'Migrations summary: 1 applied, 1 skipped',
    'Migrations summary: 1 apply, 1 skipped.',
    'Migrations summary: -1 applied, 1 skipped.',
    'Migrations summary: 1.5 applied, 1 skipped.',
    'Migrations summary: 1 applied, 1 skipped. trailing',
  ])('rejects grammar drift without echoing rejected text: %s', (line) => {
    let message = '';
    try {
      extractGithubMigrationSemanticLines(line, identity);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/123:456.*invalid/i);
    expect(message).not.toContain(line);
  });

  it('rejects ambiguous markers and control bytes inside semantic text safely', () => {
    const cases = [
      'ordinary output only',
      `prefix → applying:        20260714220000  quiz ✓ applied:         20260714220000  quiz`,
      semanticLog.replace('→ applying:', '→ applying:\uFEFF'),
      semanticLog.replace(
        'quiz_event_lifecycle_followup',
        'quiz\u001B_event_lifecycle_followup'
      ),
      semanticLog.replace('\n', '\r'),
    ];
    for (const rawLog of cases) {
      expect(() =>
        extractGithubMigrationSemanticLines(rawLog, identity)
      ).toThrow(/123:456/);
    }
  });
});
