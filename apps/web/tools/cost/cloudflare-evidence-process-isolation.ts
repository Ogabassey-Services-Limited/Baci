import {
  lstat,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import {
  EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST,
  type EvidenceDependencyIntegrityManifest,
  readReviewedEvidenceDependencyManifest,
  verifyEvidenceDependencyFile,
} from './cloudflare-evidence-dependency-integrity';
import { verifyCredentialedEvidenceCommandImportClosure } from './cloudflare-evidence-import-closure';
import { cloudflareEvidencePrepare } from './cloudflare-evidence-prepare';
import { prepareEvidenceProcessEnvironment } from './cloudflare-evidence-process-environment';
import {
  type EvidenceRunInput,
  loadEvidenceRunForCleanup,
} from './cloudflare-evidence-run-journal';
import {
  evidenceRunnerModuleEnvironmentNames,
  verifyReviewedEvidenceFile,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';
import { buildClosedEvidenceProcessEnvironment } from './qualify-cloudflare-evidence-sources';

export type EvidenceChildCommand = 'prepare' | 'mutate' | 'cleanup' | 'measure';
export type EvidenceProcessSpawner = Readonly<{
  spawn(
    executable: string,
    argv: readonly string[],
    options: Readonly<{ cwd: string; env: Record<string, string> }>
  ): Promise<void>;
}>;
type Credential = Readonly<{
  name: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN';
  value: string;
}>;

const argumentsFor = (
  command: EvidenceChildCommand,
  runId: string,
  prepareInput?: EvidenceRunInput
) => {
  if (command === 'prepare') {
    if (!prepareInput) throw new Error('prepare input is required');
    return cloudflareEvidencePrepare.argumentsFor(prepareInput);
  }
  if (command === 'cleanup') return ['--cleanup-run', runId];
  if (command === 'mutate') return ['--run', runId, '--apply'];
  return ['--run', runId];
};
const scriptFor = (command: EvidenceChildCommand) =>
  command === 'prepare'
    ? 'qualify-cloudflare-evidence-sources.ts'
    : command === 'measure'
      ? 'measure-cloudflare-evidence-sources.ts'
      : 'mutate-cloudflare-evidence-sources.ts';
const pinnedTsx = (workspaceRoot: string) =>
  resolve(workspaceRoot, 'node_modules/.bin/tsx');
const absoluteToolPath = (
  workspaceRoot: string,
  command: EvidenceChildCommand
) => resolve(workspaceRoot, 'apps/web/tools/cost', scriptFor(command));

async function verifyReviewedPackageClosure(
  workspaceRoot: string,
  packageName: string,
  manifest: EvidenceDependencyIntegrityManifest
) {
  const metadata = manifest.packages[packageName];
  if (!metadata)
    throw new Error('tsx runtime dependency lacks reviewed integrity metadata');
  const packageRoot = resolve(workspaceRoot, metadata.root);
  for (const file of Object.keys(metadata.files))
    await verifyEvidenceDependencyFile(
      workspaceRoot,
      packageName,
      resolve(packageRoot, file),
      manifest
    );
  const value = JSON.parse(
    await readFile(resolve(packageRoot, 'package.json'), 'utf8')
  ) as { dependencies?: Record<string, unknown> };
  for (const dependency of Object.keys(value.dependencies ?? {}))
    await verifyReviewedPackageClosure(workspaceRoot, dependency, manifest);
}

async function resolveShebangNode(pathValue: string | undefined) {
  if (!pathValue) throw new Error('tsx shebang runtime PATH is required');
  const entries = pathValue.split(delimiter);
  if (entries.some((entry) => !entry || !isAbsolute(entry)))
    throw new Error(
      'tsx shebang runtime PATH must contain only absolute directories'
    );
  const expected = await realpath(process.execPath);
  for (const entry of entries) {
    const candidate = resolve(entry, 'node');
    const candidateStat = await lstat(candidate).catch(() => undefined);
    if (!candidateStat) continue;
    if (candidateStat.isDirectory())
      throw new Error('tsx shebang runtime node is not a regular executable');
    const resolved = await realpath(candidate).catch(() => undefined);
    if (!resolved || resolved !== expected)
      throw new Error(
        'tsx shebang runtime node does not match the reviewed runtime'
      );
    return resolved;
  }
  throw new Error('tsx shebang runtime node is not on the reviewed PATH');
}

export async function verifyReviewedTsxLauncher(
  workspaceRoot: string,
  manifest: EvidenceDependencyIntegrityManifest,
  pathValue = process.env.PATH
) {
  if (!isAbsolute(workspaceRoot))
    throw new Error('evidence workspace root must be absolute');
  const launcher = pinnedTsx(workspaceRoot);
  const launcherStat = await lstat(launcher).catch(() => undefined);
  if (!launcherStat?.isSymbolicLink())
    throw new Error('tsx launcher must remain the reviewed symlink');
  if ((await readlink(launcher)) !== '../tsx/dist/cli.mjs')
    throw new Error('tsx launcher symlink target is not reviewed');
  const target = await verifyEvidenceDependencyFile(
    workspaceRoot,
    'tsx',
    launcher,
    manifest
  );
  const expectedTarget = await realpath(
    resolve(dirname(launcher), '../tsx/dist/cli.mjs')
  ).catch(() => undefined);
  if (!expectedTarget || target !== expectedTarget)
    throw new Error('tsx launcher target is not reviewed');
  const firstLine = (await readFile(target, 'utf8')).split(/\r?\n/u, 1)[0];
  if (firstLine !== '#!/usr/bin/env node')
    throw new Error('tsx launcher shebang is not reviewed');
  const nodePath = await resolveShebangNode(pathValue);
  await verifyReviewedPackageClosure(workspaceRoot, 'tsx', manifest);
  return Object.freeze({ launcher, target, nodePath });
}

export async function spawnIsolatedCloudflareEvidenceProcess(
  spawner: EvidenceProcessSpawner,
  command: EvidenceChildCommand,
  runId: string,
  inherited: Readonly<Record<string, string | undefined>>,
  credential: Credential | undefined,
  workspaceRoot: string,
  stateDir: string,
  prepareInput?: EvidenceRunInput
) {
  if (!isAbsolute(workspaceRoot) || !isAbsolute(stateDir))
    throw new Error(
      'workspace root and evidence state directory must be absolute'
    );
  const needsCredential = command !== 'prepare';
  if (needsCredential !== Boolean(credential))
    throw new Error('command credential responsibility is invalid');
  if (
    (command === 'mutate' || command === 'cleanup') &&
    credential?.name !== 'CLOUDFLARE_WRITE_TOKEN'
  )
    throw new Error('write command requires only the write credential');
  if (command === 'measure' && credential?.name !== 'CLOUDFLARE_READ_TOKEN')
    throw new Error('measurement requires only the read credential');
  const privateHome = await mkdtemp(join(tmpdir(), 'baci-evidence-home-'));
  try {
    const env = credential
      ? buildClosedEvidenceProcessEnvironment(
          credential.name,
          credential.value,
          inherited
        )
      : prepareEvidenceProcessEnvironment(inherited);
    env.HOME = privateHome;
    env.XDG_CONFIG_HOME = join(privateHome, 'config');
    env.XDG_DATA_HOME = join(privateHome, 'data');
    env.EVIDENCE_RUN_STATE_DIR = stateDir;
    env.EVIDENCE_WORKSPACE_ROOT = workspaceRoot;
    const journal =
      command === 'prepare'
        ? undefined
        : await loadEvidenceRunForCleanup(stateDir, runId);
    let commandPath = absoluteToolPath(workspaceRoot, command);
    if (journal) {
      commandPath = (
        await verifyReviewedEvidenceFile(
          workspaceRoot,
          journal.toolingMergeSha,
          commandPath
        )
      ).path;
      const manifestPath = inherited[EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST];
      if (!manifestPath || !isAbsolute(manifestPath))
        throw new Error(
          'credentialed command dependency integrity manifest is required'
        );
      if (!journal.dependencyManifestSha256)
        throw new Error(
          'journal is missing the authenticated dependency integrity manifest hash'
        );
      const reviewedDependencies = await readReviewedEvidenceDependencyManifest(
        workspaceRoot,
        journal.toolingMergeSha,
        manifestPath,
        journal.dependencyManifestSha256
      );
      env[EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST] = reviewedDependencies.path;
      await verifyReviewedTsxLauncher(
        workspaceRoot,
        reviewedDependencies.manifest,
        env.PATH
      );
      await verifyCredentialedEvidenceCommandImportClosure(
        workspaceRoot,
        journal.toolingMergeSha,
        commandPath,
        reviewedDependencies.manifest
      );
    }
    const runnerNames =
      command === 'measure'
        ? evidenceRunnerModuleEnvironmentNames('measurement')
        : command === 'prepare'
          ? undefined
          : evidenceRunnerModuleEnvironmentNames('mutation');
    if (runnerNames) {
      if (!journal) throw new Error('credentialed command journal is missing');
      const descriptor =
        command === 'measure'
          ? {
              path: journal.measurementRunnerModulePath,
              sha256: journal.measurementRunnerModuleSha256,
            }
          : {
              path: journal.mutationRunnerModulePath,
              sha256: journal.mutationRunnerModuleSha256,
            };
      const modulePath = descriptor.path;
      const moduleSha256 = descriptor.sha256;
      if (!modulePath || !moduleSha256)
        throw new Error(
          'journal is missing the reviewed runner module descriptor'
        );
      const verified = await verifyReviewedEvidenceRunnerModule(
        workspaceRoot,
        journal.toolingMergeSha,
        { path: modulePath, sha256: moduleSha256 }
      );
      env[runnerNames.path] = verified.path;
      env[runnerNames.sha256] = verified.sha256;
    }
    return await spawner.spawn(
      pinnedTsx(workspaceRoot),
      [commandPath, ...argumentsFor(command, runId, prepareInput)],
      {
        cwd: workspaceRoot,
        env,
      }
    );
  } finally {
    await rm(privateHome, { recursive: true, force: true });
  }
}
