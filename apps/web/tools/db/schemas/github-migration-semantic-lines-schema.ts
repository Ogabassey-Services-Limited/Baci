import { createHash } from 'node:crypto';
import { z } from 'zod';

const positiveInteger = z.number().int().positive().safe();
const nonnegativeInteger = z.number().int().nonnegative().safe();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const migrationVersion = z.string().regex(/^\d{14}$/);
const migrationName = z.string().regex(/^[a-z0-9_]+$/);

const migrationLineSchema = z
  .object({
    kind: z.literal('migration'),
    marker: z.enum(['→ applying:', '✓ applied:', '✓ already applied:']),
    version: migrationVersion,
    name: migrationName,
  })
  .strict();

const summaryLineSchema = z
  .object({
    kind: z.literal('summary'),
    marker: z.literal('Migrations summary:'),
    applied: nonnegativeInteger,
    skipped: nonnegativeInteger,
  })
  .strict();

const semanticLineSchema = z.discriminatedUnion('kind', [
  migrationLineSchema,
  summaryLineSchema,
]);

const sourceSchema = z
  .object({
    kind: z.enum(['primary', 'corroboration']),
    deploymentRunId: positiveInteger,
    databaseJobId: positiveInteger,
    sanitizedJobLogSha256: sha256,
    lines: z.array(semanticLineSchema).min(1),
  })
  .strict();

type SourceBinding = {
  kind: 'primary' | 'corroboration';
  deploymentRunId: number;
  databaseJobId: number;
  sanitizedJobLogSha256: string;
};

function sourceKey(source: {
  deploymentRunId: number;
  databaseJobId: number;
}): string {
  return `${source.deploymentRunId}:${source.databaseJobId}`;
}

function semanticBytes(lines: z.infer<typeof semanticLineSchema>[]): string {
  return lines
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
}

export const githubMigrationSemanticLinesSchema = z
  .object({
    schemaVersion: z.literal(1),
    sanitizerVersion: z.literal('github-actions-migration-semantic-lines-v1'),
    sources: z.array(sourceSchema).length(26),
  })
  .strict()
  .superRefine((fixture, context) => {
    const sourceKeys = new Set<string>();
    let primaryCount = 0;
    let corroborationCount = 0;
    fixture.sources.forEach((source, index) => {
      if (source.kind === 'primary') primaryCount += 1;
      else corroborationCount += 1;
      const key = `${source.deploymentRunId}:${source.databaseJobId}`;
      if (sourceKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'run/job source identity must be unique',
          path: ['sources', index],
        });
      }
      sourceKeys.add(key);
      const reconstructedSha256 = createHash('sha256')
        .update(semanticBytes(source.lines))
        .digest('hex');
      if (reconstructedSha256 !== source.sanitizedJobLogSha256) {
        context.addIssue({
          code: 'custom',
          message: 'semantic source digest must match structured lines',
          path: ['sources', index, 'sanitizedJobLogSha256'],
        });
      }
      const summaries = source.lines.filter((line) => line.kind === 'summary');
      const summary = summaries[0];
      if (
        summaries.length > 1 ||
        (summary &&
          (source.lines.length === 1 || source.lines.at(-1) !== summary))
      ) {
        context.addIssue({
          code: 'custom',
          message: 'semantic summary must be unique and terminal',
          path: ['sources', index, 'lines'],
        });
      }
      if (
        summary &&
        (summary.applied !==
          source.lines.filter(
            (line) => line.kind === 'migration' && line.marker === '✓ applied:'
          ).length ||
          summary.skipped !==
            source.lines.filter(
              (line) =>
                line.kind === 'migration' &&
                line.marker === '✓ already applied:'
            ).length)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'semantic summary counts must match migration records',
          path: ['sources', index, 'lines'],
        });
      }
    });
    if (primaryCount !== 24 || corroborationCount !== 2) {
      context.addIssue({
        code: 'custom',
        message:
          'semantic fixture must contain 24 primary and 2 corroboration sources',
        path: ['sources'],
      });
    }
  });

export function githubMigrationSemanticLinesSchemaForSources(
  bindings: readonly SourceBinding[]
) {
  const expected = new Map(
    bindings.map((binding) => [sourceKey(binding), binding])
  );
  const primaryCount = bindings.filter(({ kind }) => kind === 'primary').length;
  const corroborationCount = bindings.length - primaryCount;
  if (
    bindings.length !== 26 ||
    expected.size !== bindings.length ||
    primaryCount !== 24 ||
    corroborationCount !== 2
  ) {
    throw new Error('Semantic source binding set is invalid');
  }
  return githubMigrationSemanticLinesSchema.superRefine((fixture, context) => {
    fixture.sources.forEach((source, index) => {
      const binding = expected.get(sourceKey(source));
      if (
        !binding ||
        binding.kind !== source.kind ||
        binding.sanitizedJobLogSha256 !== source.sanitizedJobLogSha256
      ) {
        context.addIssue({
          code: 'custom',
          message: 'semantic source does not match frozen provenance',
          path: ['sources', index],
        });
      }
    });
  });
}

export type GithubMigrationSemanticLines = z.infer<
  typeof githubMigrationSemanticLinesSchema
>;
export type GithubMigrationSemanticLine =
  GithubMigrationSemanticLines['sources'][number]['lines'][number];
