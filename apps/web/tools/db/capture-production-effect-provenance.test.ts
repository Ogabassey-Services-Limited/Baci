import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';
import { captureProductionEffectProvenance } from './capture-production-effect-provenance';
import { extractGithubMigrationSemanticLines } from './extract-github-migration-semantic-lines';
import {
  type ProductionEffectProvenance,
  productionEffectProvenanceSchema,
} from './schemas/production-effect-provenance-schema';

const roots: string[] = [];
const fixturePath = path.resolve(
  import.meta.dirname,
  'fixtures/production-effect-provenance.json'
);

type CapturedJob = {
  repository: string;
  deploymentRunId: number;
  databaseJobId: number;
  headSha: string;
  conclusion: 'success' | 'failure';
  rawLog: string;
};

async function temporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-provenance-capture-'));
  roots.push(root);
  return root;
}

function key(runId: number, jobId: number) {
  return `${runId}:${jobId}`;
}

function appliedLine(version: string, name: string) {
  return `✓ applied:         ${version}  ${name}\n`;
}

async function syntheticCapture() {
  const provenance = productionEffectProvenanceSchema.parse(
    JSON.parse(await readFile(fixturePath, 'utf8'))
  );
  const jobs = new Map<string, CapturedJob>();
  const records = new Map(
    provenance.exceptionalRecords.map((record) => [
      record.recordOrdinal,
      record,
    ])
  );
  const groups = new Map(
    provenance.replayConstraints.jobGroups.map((group) => [
      key(group.deploymentRunId, group.databaseJobId),
      group,
    ])
  );

  for (const source of provenance.evidenceSources) {
    const group = groups.get(key(source.deploymentRunId, source.databaseJobId));
    if (!group) throw new Error('Missing synthetic job group');
    const entries = Array.from(
      { length: group.observedMigrationEntryCount },
      (_, index) => ({
        version: String(90000000000001 + index),
        name: `unobserved_${index + 1}`,
      })
    );
    if ('pipelineRecords' in group) {
      for (const record of group.pipelineRecords) {
        entries[record.logOrdinal - 1] = record.applied;
      }
    } else {
      for (const included of group.includedRecords) {
        const record = records.get(included.recordOrdinal);
        if (!record?.applied) throw new Error('Missing synthetic record');
        entries[included.logOrdinal - 1] = record.applied;
      }
    }
    let rawLog = entries
      .map((entry) => appliedLine(entry.version, entry.name))
      .join('');
    if (source.jobConclusion === 'success') {
      rawLog += `Migrations summary: ${entries.length} applied, 0 skipped.\n`;
    }
    const extracted = extractGithubMigrationSemanticLines(rawLog, source);
    source.sanitizedJobLogSha256 = extracted.sanitizedJobLogSha256;
    for (const record of provenance.exceptionalRecords) {
      if (
        record.applied &&
        record.evidence.deploymentRunId === source.deploymentRunId &&
        record.evidence.databaseJobId === source.databaseJobId
      ) {
        record.evidence.sanitizedJobLogSha256 = extracted.sanitizedJobLogSha256;
      }
    }
    jobs.set(key(source.deploymentRunId, source.databaseJobId), {
      repository: 'ogabasseyy/Baci',
      deploymentRunId: source.deploymentRunId,
      databaseJobId: source.databaseJobId,
      headSha: source.headSha,
      conclusion: source.jobConclusion === 'success' ? 'success' : 'failure',
      rawLog,
    });
  }

  for (const source of provenance.evidenceSources) {
    if (!source.corroboration) continue;
    const record = provenance.exceptionalRecords.find(
      (candidate) =>
        candidate.applied &&
        candidate.evidence.corroboration?.deploymentRunId ===
          source.corroboration?.deploymentRunId
    );
    if (!record?.applied) throw new Error('Missing corroborated record');
    const rawLog =
      `✓ already applied: ${record.applied.version}  ${record.applied.name}\n` +
      'Migrations summary: 0 applied, 1 skipped.\n';
    const extracted = extractGithubMigrationSemanticLines(
      rawLog,
      source.corroboration
    );
    source.corroboration.sanitizedJobLogSha256 =
      extracted.sanitizedJobLogSha256;
    for (const candidate of provenance.exceptionalRecords) {
      if (
        candidate.applied &&
        candidate.evidence.corroboration?.deploymentRunId ===
          source.corroboration.deploymentRunId
      ) {
        candidate.evidence.corroboration.sanitizedJobLogSha256 =
          extracted.sanitizedJobLogSha256;
      }
    }
    jobs.set(
      key(
        source.corroboration.deploymentRunId,
        source.corroboration.databaseJobId
      ),
      {
        repository: 'ogabasseyy/Baci',
        deploymentRunId: source.corroboration.deploymentRunId,
        databaseJobId: source.corroboration.databaseJobId,
        headSha: source.corroboration.headSha,
        conclusion: 'success',
        rawLog,
      }
    );
  }
  const canonical = canonicalReplayFixtureJson(provenance);
  return {
    provenance,
    provenanceSha256: createHash('sha256').update(canonical).digest('hex'),
    jobs,
  };
}

function dependencies(capture: Awaited<ReturnType<typeof syntheticCapture>>) {
  return {
    loadProvenance: async () => ({
      provenance: capture.provenance,
      sha256: capture.provenanceSha256,
    }),
    readJob: async (source: {
      deploymentRunId: number;
      databaseJobId: number;
    }) => {
      const job = capture.jobs.get(
        key(source.deploymentRunId, source.databaseJobId)
      );
      if (!job) throw new Error('Missing synthetic job');
      return job;
    },
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('captureProductionEffectProvenance', () => {
  it('creates one canonical structured 26-source fixture with no raw log text', async () => {
    const root = await temporaryRoot();
    const capture = await syntheticCapture();
    const result = await captureProductionEffectProvenance(
      {
        workspaceRoot: root,
        semanticFixtureOutput: 'semantic-lines.json',
      },
      dependencies(capture)
    );
    const bytes = await readFile(
      path.join(root, 'semantic-lines.json'),
      'utf8'
    );

    expect(result.sourceCount).toBe(26);
    expect(JSON.parse(bytes).sources).toHaveLength(26);
    expect(bytes).not.toContain('Migrations summary: 1 applied');
    expect(bytes).toBe(canonicalReplayFixtureJson(JSON.parse(bytes)));
  });

  it('verifies an existing fixture without rewriting it', async () => {
    const root = await temporaryRoot();
    const capture = await syntheticCapture();
    const captureDependencies = dependencies(capture);
    const options = {
      workspaceRoot: root,
      semanticFixtureOutput: 'semantic-lines.json',
    };
    await captureProductionEffectProvenance(options, captureDependencies);
    const before = await readFile(path.join(root, 'semantic-lines.json'));
    await captureProductionEffectProvenance(
      { ...options, verifyOnly: true },
      captureDependencies
    );
    expect(await readFile(path.join(root, 'semantic-lines.json'))).toEqual(
      before
    );
  });

  it('fails closed on existing create output and escaped output paths', async () => {
    const root = await temporaryRoot();
    const capture = await syntheticCapture();
    const captureDependencies = dependencies(capture);
    await writeFile(path.join(root, 'exists.json'), '{}\n');
    await expect(
      captureProductionEffectProvenance(
        {
          workspaceRoot: root,
          semanticFixtureOutput: 'exists.json',
        },
        captureDependencies
      )
    ).rejects.toThrow(/exists|create/i);
    await expect(
      captureProductionEffectProvenance(
        { workspaceRoot: root, semanticFixtureOutput: '../escape.json' },
        captureDependencies
      )
    ).rejects.toThrow(/output path/i);
  });

  it('rejects metadata and semantic evidence drift without echoing raw logs', async () => {
    const root = await temporaryRoot();
    const capture = await syntheticCapture();
    const first = capture.jobs.values().next().value as CapturedJob;
    first.headSha = '0'.repeat(40);
    first.rawLog += 'Bearer secret-bearing-material-that-must-not-escape';
    let message = '';
    try {
      await captureProductionEffectProvenance(
        { workspaceRoot: root, semanticFixtureOutput: 'semantic-lines.json' },
        dependencies(capture)
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/metadata/i);
    expect(message).not.toContain('Bearer');
  });

  it('rejects a validly hashed log that does not contain the bound record', async () => {
    const root = await temporaryRoot();
    const capture = await syntheticCapture();
    const provenance = structuredClone(
      capture.provenance
    ) as ProductionEffectProvenance;
    const first = provenance.exceptionalRecords[0];
    if (!first.applied) throw new Error('Expected applied record');
    first.applied.name = 'different_bound_name';
    const canonical = canonicalReplayFixtureJson(provenance);

    await expect(
      captureProductionEffectProvenance(
        { workspaceRoot: root, semanticFixtureOutput: 'semantic-lines.json' },
        {
          ...dependencies(capture),
          loadProvenance: async () => ({
            provenance,
            sha256: createHash('sha256').update(canonical).digest('hex'),
          }),
        }
      )
    ).rejects.toThrow(/bound applied entry/i);
  });
});
