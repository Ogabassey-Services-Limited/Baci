import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSupabaseManagementReadOnlyExecutor } from './create-supabase-management-read-only-executor';
import { extractGithubMigrationSemanticLines } from './extract-github-migration-semantic-lines';
import { parseGithubMigrationJobLog } from './parse-github-migration-job-log';
import { postReplayProductionAttestationReceipt as receipt } from './post-replay-production-attestation-receipt';
import { readSupabaseHistoryEffects } from './read-supabase-history-effects';
import { replayRepository } from './replay-repository-root';
import { replayCommandRuntime } from './run-replay-command';
import { linkedMigrationLedgerSchema } from './schemas/linked-migration-ledger-schema';
import { productionHistoryEffectsSchema } from './schemas/production-history-effects-schema';
import { supabaseHistoryEffectQueryContract } from './supabase-history-effect-query-contract';
import { verifyPostReplayProductionAttestation } from './verify-post-replay-production-attestation';
import { verifySupabaseHistoryReplayManifest } from './verify-supabase-history-replay-manifest';

const LEDGER_QUERY =
  'SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version';
type LedgerRow = { name: string; version: string };
type GithubDeployment = {
  job: { conclusion: string; headSha: string; id: number; runId: number };
  rawLog: string;
  run: { conclusion: string; headSha: string; id: number };
};
type DeploymentEvidence = {
  appliedEntries: LedgerRow[];
  databaseJob: { conclusion: string; id: number };
  mergeSha: string;
  run: { conclusion: string; headSha: string; id: number };
  semanticLogSha256: string;
  summary: { applied: number; skipped: number };
};
type Dependencies = {
  createExecutor?: typeof createSupabaseManagementReadOnlyExecutor;
  readEffects?: typeof readSupabaseHistoryEffects;
  readDeploymentEvidence?: () => Promise<DeploymentEvidence>;
  readGithubJob?: (workspaceRoot: string) => Promise<GithubDeployment>;
  readTextFile?: (filePath: string) => Promise<string>;
  verifyManifest?: typeof verifySupabaseHistoryReplayManifest;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function ledgerRows(value: unknown[]): LedgerRow[] {
  const rows = value.map((candidate) => {
    const row = record(candidate);
    if (
      !row ||
      typeof row.name !== 'string' ||
      typeof row.version !== 'string'
    ) {
      throw new Error('Live ledger receipt is invalid');
    }
    return { name: row.name, version: row.version };
  });
  if (rows.length === 0) throw new Error('Live ledger receipt is invalid');
  return rows;
}

const EFFECT_KEYS =
  'componentCount|customerCancellationSurfacePresent|domainEventRpcCount|eventPolicyRolesExact|everyDomainEventProducerDisabled|fulfillmentTimestampsReady|merchantAnonProjectionExact|merchantFeatureSettingsReadWithheld|pgmqDomainEventsQueuePresent|pgmqProtectedRolesWithheld|pgmqPublicSchemaAbsent|requiredExtensionsPresent'.split(
    '|'
  );
type SafeEffects = Record<string, boolean | number> & {
  componentCount: number;
  domainEventRpcCount: number;
};
function safeEffects(value: Record<string, boolean | number>): SafeEffects {
  return Object.fromEntries(
    EFFECT_KEYS.map((key) => [key, value[key]])
  ) as SafeEffects;
}

function githubMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = record(JSON.parse(value) as unknown);
    if (!parsed) throw new Error('invalid');
    return parsed;
  } catch {
    throw new Error('GitHub deployment receipt unavailable');
  }
}

async function defaultGithubDeployment(
  workspaceRoot: string
): Promise<GithubDeployment> {
  const expected = receipt.deployment;
  const runCommand = replayCommandRuntime.create(workspaceRoot);
  let run: Record<string, unknown>;
  let job: Record<string, unknown>;
  let rawLog: string;
  try {
    [run, job, rawLog] = await Promise.all([
      runCommand('gh', [
        'api',
        `repos/ogabasseyy/Baci/actions/runs/${expected.run.id}`,
      ]).then(({ stdout }) => githubMetadata(stdout)),
      runCommand('gh', [
        'api',
        `repos/ogabasseyy/Baci/actions/jobs/${expected.databaseJob.id}`,
      ]).then(({ stdout }) => githubMetadata(stdout)),
      runCommand('gh', [
        'api',
        `repos/ogabasseyy/Baci/actions/jobs/${expected.databaseJob.id}/logs`,
      ]).then(({ stdout }) => stdout),
    ]);
  } catch {
    throw new Error('GitHub deployment receipt unavailable');
  }
  if (
    typeof run.id !== 'number' ||
    typeof run.head_sha !== 'string' ||
    typeof run.conclusion !== 'string' ||
    typeof job.id !== 'number' ||
    typeof job.run_id !== 'number' ||
    typeof job.head_sha !== 'string' ||
    typeof job.conclusion !== 'string'
  ) {
    throw new Error('GitHub deployment receipt unavailable');
  }
  return {
    job: {
      conclusion: job.conclusion,
      headSha: job.head_sha,
      id: job.id,
      runId: job.run_id,
    },
    rawLog,
    run: { conclusion: run.conclusion, headSha: run.head_sha, id: run.id },
  };
}

function deploymentEvidence(value: GithubDeployment): DeploymentEvidence {
  const expected = receipt.deployment;
  if (
    value.run.id !== expected.run.id ||
    value.job.id !== expected.databaseJob.id ||
    value.job.runId !== value.run.id ||
    value.job.headSha !== value.run.headSha
  ) {
    throw new Error('GitHub deployment receipt mismatch');
  }
  const extracted = extractGithubMigrationSemanticLines(value.rawLog, {
    databaseJobId: value.job.id,
    deploymentRunId: value.run.id,
  });
  const parsed = parseGithubMigrationJobLog(extracted.lines);
  if (!parsed.summary) throw new Error('GitHub deployment receipt mismatch');
  return {
    appliedEntries: parsed.appliedEntries.map(({ name, version }) => ({
      name,
      version,
    })),
    databaseJob: { conclusion: value.job.conclusion, id: value.job.id },
    mergeSha: value.run.headSha,
    run: value.run,
    semanticLogSha256: extracted.sanitizedJobLogSha256,
    summary: parsed.summary,
  };
}

export async function attestPostReplayProduction(
  options: { workspaceRoot: string },
  dependencies: Dependencies = {}
) {
  const verifyManifest =
    dependencies.verifyManifest ?? verifySupabaseHistoryReplayManifest;
  await verifyManifest(options.workspaceRoot, {
    pendingRepairState: 'materialized',
  });
  const readText =
    dependencies.readTextFile ??
    ((filePath: string) => readFile(filePath, 'utf8'));
  const [frozenLedgerBody, frozenEffectBody, effectQuery] = await Promise.all([
    readText(
      path.join(
        options.workspaceRoot,
        'apps/web/tools/db/fixtures/linked-migration-ledger.json'
      )
    ),
    readText(
      path.join(
        options.workspaceRoot,
        'apps/web/tools/db/fixtures/production-history-effects.json'
      )
    ),
    readText(
      path.join(
        options.workspaceRoot,
        'apps/web/tools/db/supabase-history-effects.sql'
      )
    ),
  ]);
  const frozenLedger = linkedMigrationLedgerSchema.parse(
    JSON.parse(frozenLedgerBody)
  );
  const frozenEffect = productionHistoryEffectsSchema.parse(
    JSON.parse(frozenEffectBody)
  );
  const executeSelect = await (
    dependencies.createExecutor ?? createSupabaseManagementReadOnlyExecutor
  )(options.workspaceRoot);
  const liveLedger = ledgerRows(await executeSelect(LEDGER_QUERY));
  const live = await (dependencies.readEffects ?? readSupabaseHistoryEffects)({
    comparisonMode: 'classify',
    effectQuery,
    executeSelect,
    expectedEffectQuerySha256: supabaseHistoryEffectQueryContract.querySha256,
    productionFixture: frozenEffectBody,
  });
  if (live.comparison?.mode !== 'classify') {
    throw new Error('Production effect receipt mismatch');
  }
  const comparison = live.comparison;
  if (
    comparison.productionEffectSha256 !== frozenEffect.effectSha256 ||
    comparison.changedComponents.some(
      ({ localSha256, productionSha256 }) => !localSha256 || !productionSha256
    )
  ) {
    throw new Error('Production effect receipt mismatch');
  }
  const deployment = dependencies.readDeploymentEvidence
    ? await dependencies.readDeploymentEvidence()
    : deploymentEvidence(
        await (dependencies.readGithubJob ?? defaultGithubDeployment)(
          options.workspaceRoot
        )
      );
  return verifyPostReplayProductionAttestation({
    comparison: {
      changedComponents: comparison.changedComponents.map((change) => ({
        category: change.category,
        frozenSha256: change.productionSha256 as string,
        identity: change.identity,
        liveSha256: change.localSha256 as string,
      })),
    },
    deployment,
    frozenEffect: {
      ...frozenEffect,
      effects: safeEffects(frozenEffect.effects),
    },
    frozenLedger: {
      inventorySha256: receipt.ledger.frozenPrefix.inventorySha256,
      rowCount: frozenLedger.rows.length,
      rows: frozenLedger.rows.map(({ name, version }) => ({ name, version })),
      tailVersion: frozenLedger.rows.at(-1)?.version ?? '',
    },
    liveEffect: {
      baseSha: frozenEffect.baseSha,
      digestVector: live.digestVector,
      effectSha256: live.effectSha256,
      effects: safeEffects(live.effects),
      ledger: {
        rowCount: liveLedger.length,
        tailVersion: liveLedger.at(-1)?.version ?? '',
      },
      schemaVersion: 2,
      scope: {
        componentCount: live.effects.componentCount,
        manifestSha256: supabaseHistoryEffectQueryContract.scopeManifestSha256,
        version: live.scopeVersion,
      },
      source: {
        kind: 'supabase-management-api-read-only',
        querySha256: supabaseHistoryEffectQueryContract.querySha256,
        serverVersionNum: live.serverVersionNum,
      },
    },
    liveLedger: {
      inventorySha256: receipt.ledger.live.inventorySha256,
      rowCount: liveLedger.length,
      rows: liveLedger,
      tailVersion: liveLedger.at(-1)?.version ?? '',
    },
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  attestPostReplayProduction({
    workspaceRoot: replayRepository.root(import.meta.dirname),
  })
    .then((safeReceipt) =>
      process.stdout.write(`${JSON.stringify(safeReceipt)}\n`)
    )
    .catch(() => {
      process.exitCode = 1;
    });
}
