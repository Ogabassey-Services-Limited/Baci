import { resolve } from 'node:path';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
import { loadEvidenceRunForCleanup } from './cloudflare-evidence-run-journal';
import {
  verifyReviewedEvidenceFile,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';
import type { EvidenceMeasurementDependencies } from './measure-cloudflare-evidence-sources';

type MeasurementRunnerFactory = (
  input: Readonly<{
    token: string;
    runId: string;
    stateDir: string;
  }>
) => Promise<EvidenceMeasurementDependencies>;

export async function loadMeasurementDependencies(
  runId: string,
  stateDir: string
) {
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  const workspaceRoot = process.env.EVIDENCE_WORKSPACE_ROOT;
  if (!workspaceRoot)
    throw new Error('absolute EVIDENCE_WORKSPACE_ROOT is required');
  const commandPath = resolve(
    workspaceRoot,
    'apps/web/tools/cost/measure-cloudflare-evidence-sources.ts'
  );
  if (!process.argv[1] || resolve(process.argv[1]) !== commandPath)
    throw new Error('measurement command entrypoint is not reviewed');
  await verifyReviewedEvidenceFile(
    workspaceRoot,
    journal.toolingMergeSha,
    commandPath
  );
  const configuredPath = process.env.EVIDENCE_MEASUREMENT_RUNNER_MODULE;
  const configuredSha256 =
    process.env.EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256;
  const modulePath = journal.measurementRunnerModulePath;
  const token = process.env.CLOUDFLARE_READ_TOKEN;
  if (!modulePath || !journal.measurementRunnerModuleSha256)
    throw new Error(
      'measurement runner module descriptor is missing from the journal'
    );
  if (configuredPath && resolve(configuredPath) !== resolve(modulePath))
    throw new Error('measurement runner module does not match the journal');
  if (
    configuredSha256 &&
    configuredSha256 !== journal.measurementRunnerModuleSha256
  )
    throw new Error(
      'measurement runner module hash does not match the journal'
    );
  if (!token)
    throw new Error(
      'measurement requires a provider runner module and the isolated read token'
    );
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    journal.toolingMergeSha,
    { path: modulePath, sha256: journal.measurementRunnerModuleSha256 }
  );
  return importReviewedEvidenceModule(
    workspaceRoot,
    verified.path,
    verified.files,
    (loaded) => {
      const factory =
        loaded &&
        typeof loaded === 'object' &&
        'createMeasurementDependencies' in loaded
          ? (loaded as { createMeasurementDependencies?: unknown })
              .createMeasurementDependencies
          : undefined;
      if (typeof factory !== 'function')
        throw new Error('measurement runner module is invalid');
      return (factory as MeasurementRunnerFactory)({ token, runId, stateDir });
    }
  );
}
