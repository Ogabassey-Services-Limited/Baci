import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { githubMigrationSemanticLinesSchemaForSources } from './schemas/github-migration-semantic-lines-schema';

type SemanticSource = {
  databaseJobId: number;
  deploymentRunId: number;
  kind: 'primary' | 'corroboration';
  sanitizedJobLogSha256: string;
};

type SemanticFixture = {
  sources: SemanticSource[];
};

type ProvenanceFixture = {
  evidenceSources: Array<{
    databaseJobId: number;
    deploymentRunId: number;
    sanitizedJobLogSha256: string;
    corroboration?: {
      databaseJobId: number;
      deploymentRunId: number;
      sanitizedJobLogSha256: string;
    };
  }>;
};

const fixtures = path.resolve(import.meta.dirname, 'fixtures');

async function semanticContract() {
  const [fixture, provenance] = (await Promise.all(
    [
      'github-migration-semantic-lines.json',
      'production-effect-provenance.json',
    ].map(async (name) =>
      JSON.parse(await readFile(path.join(fixtures, name), 'utf8'))
    )
  )) as [SemanticFixture, ProvenanceFixture];
  const bindings = provenance.evidenceSources.flatMap((source) => [
    {
      databaseJobId: source.databaseJobId,
      deploymentRunId: source.deploymentRunId,
      kind: 'primary' as const,
      sanitizedJobLogSha256: source.sanitizedJobLogSha256,
    },
    ...(source.corroboration
      ? [
          {
            databaseJobId: source.corroboration.databaseJobId,
            deploymentRunId: source.corroboration.deploymentRunId,
            kind: 'corroboration' as const,
            sanitizedJobLogSha256: source.corroboration.sanitizedJobLogSha256,
          },
        ]
      : []),
  ]);
  return {
    fixture,
    schema: githubMigrationSemanticLinesSchemaForSources(bindings),
  };
}

describe('Task 8 GitHub semantic source contract', () => {
  it('accepts 25 primary and two corroboration sources', async () => {
    const { fixture, schema } = await semanticContract();
    const parsed = schema.parse(fixture);
    expect(parsed.sources).toHaveLength(27);
    expect(
      parsed.sources.filter(({ kind }) => kind === 'primary')
    ).toHaveLength(25);
  });

  it('rejects a corrupted source identity or classification swap', async () => {
    const { fixture, schema } = await semanticContract();
    const wrongSource = structuredClone(fixture);
    const firstSource = wrongSource.sources[0];
    if (!firstSource) throw new Error('Expected semantic source');
    firstSource.deploymentRunId = 1;
    expect(() => schema.parse(wrongSource)).toThrow(
      /semantic source does not match frozen provenance/
    );

    const wrongClassification = structuredClone(fixture);
    const primary = wrongClassification.sources.find(
      ({ kind }) => kind === 'primary'
    );
    const corroboration = wrongClassification.sources.find(
      ({ kind }) => kind === 'corroboration'
    );
    if (!primary || !corroboration) {
      throw new Error('Expected primary and corroboration sources');
    }
    primary.kind = 'corroboration';
    corroboration.kind = 'primary';
    expect(() => schema.parse(wrongClassification)).toThrow(
      /semantic source does not match frozen provenance/
    );
  });
});
