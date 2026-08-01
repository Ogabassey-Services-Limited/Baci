import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { EvidenceDependencyIntegrityManifest } from './cloudflare-evidence-dependency-integrity';
import { EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST } from './cloudflare-evidence-dependency-integrity';
import { verifyCredentialedEvidenceCommandImportClosure } from './cloudflare-evidence-import-closure';
import type { EvidenceChildCommand } from './cloudflare-evidence-process-isolation';
import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';
import type { ReviewedEvidenceModuleSource } from './cloudflare-evidence-runner-modules';
import {
  evidenceRunnerModuleEnvironmentNames,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';

const execFileAsync = promisify(execFile);

export type PrivateEvidenceClosure = Readonly<{
  root: string;
  commandPath: string;
  launcherTarget: string;
  dependencyManifestPath: string;
  runnerPaths: Readonly<Record<string, string>>;
}>;

function relativeWorkspacePath(workspaceRoot: string, file: string) {
  const path = relative(resolve(workspaceRoot), resolve(file));
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error('reviewed closure file is outside the workspace');
  return path;
}

async function writePrivateFile(root: string, path: string, bytes: Uint8Array) {
  const destination = resolve(root, path);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, bytes, { mode: 0o400 });
  return destination;
}

async function writePrivateManifest(
  root: string,
  sourcePath: string,
  expectedSha256: string
) {
  const bytes = await readFile(sourcePath);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedSha256)
    throw new Error('dependency integrity manifest changed while being copied');
  const destination = resolve(root, 'private-dependency-integrity.json');
  await writeFile(destination, bytes, { mode: 0o600 });
  return destination;
}

async function gitShow(root: string, mergeSha: string, path: string) {
  const relativePath = relativeWorkspacePath(root, path);
  const result = await execFileAsync(
    'git',
    ['-C', root, 'show', `${mergeSha}:${relativePath}`],
    { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }
  );
  return Buffer.isBuffer(result.stdout)
    ? result.stdout
    : Buffer.from(result.stdout);
}

async function copyTrackedFiles(
  root: string,
  privateRoot: string,
  mergeSha: string,
  files: readonly string[]
) {
  for (const file of new Set(files)) {
    const relativePath = relativeWorkspacePath(root, file);
    if (
      relativePath === 'node_modules' ||
      relativePath.startsWith('node_modules/')
    )
      continue;
    await writePrivateFile(
      privateRoot,
      relativePath,
      await gitShow(root, mergeSha, file)
    );
  }
}

async function copyReviewedModuleFiles(
  root: string,
  privateRoot: string,
  files: readonly ReviewedEvidenceModuleSource[]
) {
  for (const file of files)
    await writePrivateFile(
      privateRoot,
      relativeWorkspacePath(root, file.path),
      file.source
    );
}

async function copyDependencies(
  root: string,
  privateRoot: string,
  manifest: EvidenceDependencyIntegrityManifest
) {
  for (const [name, metadata] of Object.entries(manifest.packages)) {
    const sourceRoot = resolve(root, metadata.root);
    const privatePackageRoot = resolve(privateRoot, metadata.root);
    for (const [file, expected] of Object.entries(metadata.files)) {
      const bytes = await readFile(resolve(sourceRoot, file));
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== expected)
        throw new Error(`bare package ${name} changed while being copied`);
      await writePrivateFile(
        privateRoot,
        relative(privateRoot, resolve(privatePackageRoot, file)),
        bytes
      );
    }
    const topLevel = resolve(privateRoot, 'node_modules', name);
    if (topLevel !== privatePackageRoot) {
      await mkdir(dirname(topLevel), { recursive: true, mode: 0o700 });
      await symlink(relative(dirname(topLevel), privatePackageRoot), topLevel);
    }
  }
}

export async function createPrivateEvidenceClosure(
  input: Readonly<{
    workspaceRoot: string;
    toolingMergeSha: string;
    commandPaths: readonly string[];
    runnerModules: ReadonlyArray<{
      name: string;
      path: string;
      files: readonly ReviewedEvidenceModuleSource[];
    }>;
    dependencyManifest: EvidenceDependencyIntegrityManifest;
    dependencyManifestPath: string;
    dependencyManifestSha256: string;
    commandPath: string;
    launcherTarget: string;
  }>
) {
  const root = await mkdtemp(
    join(await realpath(tmpdir()), 'baci-evidence-closure-')
  );
  await chmod(root, 0o700);
  const gitDirectory = await execFileAsync(
    'git',
    ['-C', input.workspaceRoot, 'rev-parse', '--git-dir'],
    { encoding: 'utf8' }
  );
  const gitDir = await realpath(
    resolve(input.workspaceRoot, gitDirectory.stdout.trim())
  );
  await writeFile(join(root, '.git'), `gitdir: ${gitDir}\n`, { mode: 0o400 });
  await copyTrackedFiles(input.workspaceRoot, root, input.toolingMergeSha, [
    ...input.commandPaths,
    join(input.workspaceRoot, 'pnpm-lock.yaml'),
  ]);
  for (const runner of input.runnerModules)
    await copyReviewedModuleFiles(input.workspaceRoot, root, runner.files);
  await copyDependencies(input.workspaceRoot, root, input.dependencyManifest);
  const dependencyManifestPath = await writePrivateManifest(
    root,
    input.dependencyManifestPath,
    input.dependencyManifestSha256
  );
  const map = (path: string) =>
    resolve(root, relativeWorkspacePath(input.workspaceRoot, path));
  const runnerPaths = Object.fromEntries(
    input.runnerModules.map((runner) => [runner.name, map(runner.path)])
  );
  return Object.freeze({
    root,
    commandPath: map(input.commandPath),
    launcherTarget: map(input.launcherTarget),
    dependencyManifestPath,
    runnerPaths,
  });
}

export async function preparePrivateCredentialedChild(
  input: Readonly<{
    command: Exclude<EvidenceChildCommand, 'prepare'>;
    journal: CloudflareEvidenceRunJournal;
    workspaceRoot: string;
    commandPath: string;
    args: readonly string[];
    inherited: Readonly<Record<string, string | undefined>>;
    environment: Record<string, string>;
    launcher: Readonly<{ nodePath: string; target: string }>;
    dependencies: Readonly<{
      path: string;
      manifest: EvidenceDependencyIntegrityManifest;
      sha256: string;
    }>;
  }>
) {
  const journal = input.journal;
  const commandPaths = await verifyCredentialedEvidenceCommandImportClosure(
    input.workspaceRoot,
    journal.toolingMergeSha,
    input.commandPath,
    input.dependencies.manifest
  );
  const runnerNames =
    input.command === 'measure' || input.command === 'revoke-read'
      ? evidenceRunnerModuleEnvironmentNames('measurement')
      : evidenceRunnerModuleEnvironmentNames('mutation');
  const descriptor =
    input.command === 'measure' || input.command === 'revoke-read'
      ? {
          path: journal.measurementRunnerModulePath,
          sha256: journal.measurementRunnerModuleSha256,
        }
      : {
          path: journal.mutationRunnerModulePath,
          sha256: journal.mutationRunnerModuleSha256,
        };
  if (!descriptor.path || !descriptor.sha256)
    throw new Error('journal is missing the reviewed runner module descriptor');
  const runner = await verifyReviewedEvidenceRunnerModule(
    input.workspaceRoot,
    journal.toolingMergeSha,
    { path: descriptor.path, sha256: descriptor.sha256 }
  );
  const revocationPath =
    input.inherited.EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE;
  const revocationSha256 =
    input.inherited.EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE_SHA256;
  const revocation =
    revocationPath || revocationSha256
      ? !revocationPath || !revocationSha256
        ? (() => {
            throw new Error(
              'authenticated revocation module descriptor is incomplete'
            );
          })()
        : await verifyReviewedEvidenceRunnerModule(
            input.workspaceRoot,
            journal.toolingMergeSha,
            { path: revocationPath, sha256: revocationSha256 }
          )
      : undefined;
  const closure = await createPrivateEvidenceClosure({
    workspaceRoot: input.workspaceRoot,
    toolingMergeSha: journal.toolingMergeSha,
    commandPaths,
    runnerModules: [
      { name: runnerNames.path, path: runner.path, files: runner.files },
      ...(revocation
        ? [
            {
              name: 'EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE',
              path: revocationPath as string,
              files: revocation.files,
            },
          ]
        : []),
    ],
    dependencyManifest: input.dependencies.manifest,
    dependencyManifestPath: input.dependencies.path,
    dependencyManifestSha256: input.dependencies.sha256,
    commandPath: input.commandPath,
    launcherTarget: input.launcher.target,
  });
  input.environment.EVIDENCE_EXECUTION_ROOT = closure.root;
  input.environment[EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST] =
    closure.dependencyManifestPath;
  for (const [name, path] of Object.entries(closure.runnerPaths))
    input.environment[name] = path;
  input.environment[runnerNames.sha256] = descriptor.sha256;
  if (revocationSha256)
    input.environment.EVIDENCE_WRITE_TOKEN_REVOCATION_READBACK_MODULE_SHA256 =
      revocationSha256;
  return Object.freeze({
    closure,
    executable: input.launcher.nodePath,
    executableArguments: [
      closure.launcherTarget,
      closure.commandPath,
      ...input.args,
    ],
  });
}
