import { createHash } from 'node:crypto';
import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';
import { extractGithubMigrationSemanticLines } from './extract-github-migration-semantic-lines';
import { parseGithubMigrationJobLog } from './parse-github-migration-job-log';
import { replayRepository } from './replay-repository-root';
import { replayCommandRuntime } from './run-replay-command';
import type { ForwardRepairDeploymentReceipt } from './schemas/forward-repair-deployment-receipt-schema';
import {
  type GithubMigrationSemanticLines,
  githubMigrationSemanticLinesSchemaForSources,
} from './schemas/github-migration-semantic-lines-schema';
import {
  type ProductionEffectProvenance,
  productionEffectProvenanceSchema,
} from './schemas/production-effect-provenance-schema';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';
import { verifyForwardRepairSemanticSource } from './verify-forward-repair-semantic-source';
import { verifyProductionEffectCaptureInputs } from './verify-production-effect-capture-inputs';

const REPOSITORY = 'ogabasseyy/Baci';

type ExpectedSource = {
  kind: 'primary' | 'corroboration';
  deploymentRunId: number;
  databaseJobId: number;
  headSha: string;
  expectedConclusion: 'success' | 'failure';
  sanitizedJobLogSha256: string;
};

type CapturedJob = {
  repository: string;
  deploymentRunId: number;
  databaseJobId: number;
  headSha: string;
  conclusion: 'success' | 'failure';
  rawLog: string;
};

type Dependencies = {
  loadProvenance?: () => Promise<{
    forwardRepairDeploymentReceipt: ForwardRepairDeploymentReceipt;
    provenance: ProductionEffectProvenance;
    sha256: string;
  }>;
  readJob?: (source: ExpectedSource) => Promise<CapturedJob>;
};

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function sourceKey(source: {
  deploymentRunId: number;
  databaseJobId: number;
}): string {
  return `${source.deploymentRunId}:${source.databaseJobId}`;
}

function sourceError(source: ExpectedSource, code: string): Error {
  return new Error(`GitHub source ${sourceKey(source)} ${code}`);
}

function expectedSources(
  provenance: ProductionEffectProvenance
): ExpectedSource[] {
  const sources: ExpectedSource[] = provenance.evidenceSources.map(
    (source) => ({
      ...source,
      kind: 'primary',
      expectedConclusion:
        source.jobConclusion === 'success' ? 'success' : 'failure',
    })
  );
  for (const { corroboration } of provenance.evidenceSources) {
    if (corroboration) {
      sources.push({
        ...corroboration,
        kind: 'corroboration',
        expectedConclusion: 'success',
      });
    }
  }
  return sources;
}

function verifyMetadata(expected: ExpectedSource, actual: CapturedJob): void {
  if (
    actual.repository !== REPOSITORY ||
    actual.deploymentRunId !== expected.deploymentRunId ||
    actual.databaseJobId !== expected.databaseJobId ||
    actual.headSha !== expected.headSha ||
    actual.conclusion !== expected.expectedConclusion
  ) {
    throw sourceError(expected, 'metadata mismatch');
  }
}

function verifyPrimaryLog(
  provenance: ProductionEffectProvenance,
  expected: ExpectedSource,
  parsed: ReturnType<typeof parseGithubMigrationJobLog>,
  forwardRepairDeploymentReceipt: ForwardRepairDeploymentReceipt,
  sanitizedJobLogSha256: string
): void {
  const group = provenance.replayConstraints.jobGroups.find(
    (candidate) => sourceKey(candidate) === sourceKey(expected)
  );
  if (
    !group ||
    parsed.appliedEntries.length !== group.observedMigrationEntryCount
  ) {
    throw sourceError(expected, 'applied count mismatch');
  }
  const boundEntries =
    'pipelineRecords' in group
      ? group.pipelineRecords.map((record) => ({
          applied: record.applied,
          logOrdinal: record.logOrdinal,
        }))
      : provenance.exceptionalRecords.flatMap((record) =>
          record.applied && sourceKey(record.evidence) === sourceKey(expected)
            ? [
                {
                  applied: record.applied,
                  logOrdinal: record.evidence.logOrdinal,
                },
              ]
            : []
        );
  for (const bound of boundEntries) {
    const captured = parsed.appliedEntries[bound.logOrdinal - 1];
    if (
      captured?.version !== bound.applied.version ||
      captured.name !== bound.applied.name
    ) {
      throw sourceError(expected, 'bound applied entry mismatch');
    }
  }
  if (expected.expectedConclusion === 'success' && !parsed.summary) {
    throw sourceError(expected, 'summary missing');
  }
  if (group.coverage === 'complete-deployment-repair-log-group') {
    verifyForwardRepairSemanticSource(forwardRepairDeploymentReceipt, {
      databaseJobId: expected.databaseJobId,
      deploymentRunId: expected.deploymentRunId,
      parsed,
      sanitizedJobLogSha256,
    });
  }
}

function verifyCorroborationLog(
  provenance: ProductionEffectProvenance,
  expected: ExpectedSource,
  parsed: ReturnType<typeof parseGithubMigrationJobLog>
): void {
  const records = provenance.exceptionalRecords.filter(
    (record) =>
      record.applied &&
      record.evidence.corroboration &&
      sourceKey(record.evidence.corroboration) === sourceKey(expected)
  );
  const mismatch =
    records.length === 0 ||
    records.some(
      (record) =>
        !record.applied ||
        !parsed.alreadyAppliedEntries.some(
          (entry) =>
            entry.version === record.applied?.version &&
            entry.name === record.applied?.name
        )
    );
  if (mismatch) {
    throw sourceError(expected, 'corroboration mismatch');
  }
}

async function defaultReadJob(workspaceRoot: string, expected: ExpectedSource) {
  const run = replayCommandRuntime.create(workspaceRoot);
  const endpoint = `repos/${REPOSITORY}/actions/jobs/${expected.databaseJobId}`;
  const metadataResult = await run('gh', ['api', endpoint]);
  let metadata: Record<string, unknown>;
  try {
    metadata = JSON.parse(metadataResult.stdout) as Record<string, unknown>;
  } catch {
    throw sourceError(expected, 'metadata invalid');
  }
  const logResult = await run('gh', ['api', `${endpoint}/logs`]);
  const conclusion: CapturedJob['conclusion'] | null =
    metadata.conclusion === 'success'
      ? 'success'
      : metadata.conclusion === 'failure'
        ? 'failure'
        : null;
  if (
    typeof metadata.run_id !== 'number' ||
    typeof metadata.id !== 'number' ||
    typeof metadata.head_sha !== 'string' ||
    !conclusion
  ) {
    throw sourceError(expected, 'metadata invalid');
  }
  return {
    repository: REPOSITORY,
    deploymentRunId: metadata.run_id,
    databaseJobId: metadata.id,
    headSha: metadata.head_sha,
    conclusion,
    rawLog: logResult.stdout,
  };
}

export async function captureProductionEffectProvenance(
  options: {
    workspaceRoot: string;
    semanticFixtureOutput: string;
    refreshFixture?: boolean;
    verifyOnly?: boolean;
  },
  dependencies: Dependencies = {}
): Promise<{ sourceCount: number; fixtureSha256: string }> {
  if (options.refreshFixture && options.verifyOnly) {
    throw new Error('Semantic fixture mode is invalid');
  }
  const loaded = dependencies.loadProvenance
    ? await dependencies.loadProvenance()
    : await verifyProductionEffectCaptureInputs(options.workspaceRoot).then(
        (receipts) => ({
          forwardRepairDeploymentReceipt:
            receipts.forwardRepairDeploymentReceipt,
          provenance: receipts.productionEffectProvenance,
          sha256: supabaseHistoryReplayManifest.provenance.sha256,
        })
      );
  const provenance = productionEffectProvenanceSchema.parse(loaded.provenance);
  if (sha256(canonicalReplayFixtureJson(provenance)) !== loaded.sha256) {
    throw new Error('Production-effect provenance SHA-256 mismatch');
  }
  const sourceBindings = expectedSources(provenance);
  const sources: GithubMigrationSemanticLines['sources'] = [];
  for (const expected of sourceBindings) {
    const actual = dependencies.readJob
      ? await dependencies.readJob(expected)
      : await defaultReadJob(options.workspaceRoot, expected);
    verifyMetadata(expected, actual);
    const extracted = extractGithubMigrationSemanticLines(
      actual.rawLog,
      expected
    );
    if (extracted.sanitizedJobLogSha256 !== expected.sanitizedJobLogSha256) {
      throw sourceError(expected, 'semantic digest mismatch');
    }
    const parsed = parseGithubMigrationJobLog(extracted.lines);
    if (expected.kind === 'primary') {
      verifyPrimaryLog(
        provenance,
        expected,
        parsed,
        loaded.forwardRepairDeploymentReceipt,
        extracted.sanitizedJobLogSha256
      );
    } else {
      verifyCorroborationLog(provenance, expected, parsed);
    }
    sources.push({
      kind: expected.kind,
      deploymentRunId: expected.deploymentRunId,
      databaseJobId: expected.databaseJobId,
      sanitizedJobLogSha256: extracted.sanitizedJobLogSha256,
      lines: extracted.lines,
    });
  }
  const fixture = githubMigrationSemanticLinesSchemaForSources(
    sourceBindings
  ).parse({
    schemaVersion: 1,
    sanitizerVersion: 'github-actions-migration-semantic-lines-v1',
    sources,
  });
  const bytes = canonicalReplayFixtureJson(fixture);
  const output = await replayRepository.output(
    options.workspaceRoot,
    options.semanticFixtureOutput
  );
  if (options.verifyOnly) {
    const existing = await output.read('utf8');
    if (typeof existing !== 'string' || existing !== bytes)
      throw new Error('Semantic fixture verification mismatch');
  } else if (options.refreshFixture) {
    await output.read();
    await output.replace(bytes, { mode: 0o600 });
  } else {
    await output.create(bytes, { encoding: 'utf8' }).catch(() => {
      throw new Error('Semantic fixture create failed or output exists');
    });
  }
  return { sourceCount: sources.length, fixtureSha256: sha256(bytes) };
}
