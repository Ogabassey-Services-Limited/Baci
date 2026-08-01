import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/;
const TOOLING_SHA = /^[a-f0-9]{40}$/;

export type EvidenceRunnerModuleKind = 'mutation' | 'measurement';
export type EvidenceRunnerModuleDescriptor = Readonly<{
  path: string;
  sha256: string;
}>;

const names = Object.freeze({
  mutation: Object.freeze({
    path: 'EVIDENCE_MUTATION_RUNNER_MODULE',
    sha256: 'EVIDENCE_MUTATION_RUNNER_MODULE_SHA256',
  }),
  measurement: Object.freeze({
    path: 'EVIDENCE_MEASUREMENT_RUNNER_MODULE',
    sha256: 'EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256',
  }),
} satisfies Record<
  EvidenceRunnerModuleKind,
  Readonly<{ path: string; sha256: string }>
>);

const sha256 = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

function assertDescriptor(descriptor: EvidenceRunnerModuleDescriptor) {
  if (
    !isAbsolute(descriptor.path) ||
    !SHA256.test(descriptor.sha256) ||
    descriptor.path.endsWith(sep)
  )
    throw new Error('evidence runner module descriptor is invalid');
}

function relativePath(root: string, file: string) {
  const path = relative(root, file);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error('evidence runner module must be inside the workspace');
  return path.split(sep).join('/');
}

async function assertNoSymlinkPath(root: string, file: string) {
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
    throw new Error('evidence workspace root is not a real directory');
  const relativeFile = relativePath(root, file);
  let current = root;
  for (const segment of relativeFile.split('/')) {
    current = resolve(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink())
      throw new Error('evidence runner module path contains a symlink');
  }
}

/** Reads the one path/hash pair allowed for a runner kind from an environment. */
export function readEvidenceRunnerModuleDescriptor(
  environment: Readonly<Record<string, string | undefined>>,
  kind: EvidenceRunnerModuleKind
): EvidenceRunnerModuleDescriptor {
  const descriptorNames = names[kind];
  const path = environment[descriptorNames.path];
  const sha256Value = environment[descriptorNames.sha256];
  if (!path || !sha256Value)
    throw new Error(`${kind} runner module descriptor is required`);
  const descriptor = { path, sha256: sha256Value };
  assertDescriptor(descriptor);
  return Object.freeze(descriptor);
}

/** Returns only the descriptor variable names; callers must not forward other ambient variables. */
export function evidenceRunnerModuleEnvironmentNames(
  kind: EvidenceRunnerModuleKind
) {
  return names[kind];
}

/**
 * Verifies that a runner is a tracked file from the exact reviewed tooling
 * commit and that its current bytes still equal the prepared SHA-256.
 */
export async function verifyReviewedEvidenceRunnerModule(
  workspaceRoot: string,
  toolingMergeSha: string,
  descriptor: EvidenceRunnerModuleDescriptor
): Promise<EvidenceRunnerModuleDescriptor> {
  assertDescriptor(descriptor);
  if (!TOOLING_SHA.test(toolingMergeSha))
    throw new Error('reviewed tooling merge SHA is invalid');
  if (!isAbsolute(workspaceRoot))
    throw new Error('evidence workspace root must be absolute');
  const canonicalRoot = await realpath(workspaceRoot).catch(() => {
    throw new Error('evidence workspace root is not readable');
  });
  const lexicalPath = resolve(descriptor.path);
  relativePath(canonicalRoot, lexicalPath);
  await assertNoSymlinkPath(canonicalRoot, lexicalPath);
  const canonicalPath = await realpath(descriptor.path).catch(() => {
    throw new Error('evidence runner module is not readable');
  });
  relativePath(canonicalRoot, canonicalPath);
  await assertNoSymlinkPath(canonicalRoot, canonicalPath);
  const fileStat = await lstat(canonicalPath);
  if (!fileStat.isFile())
    throw new Error('evidence runner module is not a regular file');
  const source = await readFile(canonicalPath);
  if (sha256(source) !== descriptor.sha256)
    throw new Error(
      'evidence runner module bytes do not match its reviewed hash'
    );

  const relativeModulePath = relativePath(canonicalRoot, canonicalPath);
  try {
    const tracked = await execFileAsync(
      'git',
      [
        '-C',
        canonicalRoot,
        'ls-files',
        '--error-unmatch',
        '--',
        relativeModulePath,
      ],
      { encoding: 'utf8' }
    );
    if (tracked.stdout.trim() !== relativeModulePath)
      throw new Error('evidence runner module is not tracked by git');
    const reviewed = await execFileAsync(
      'git',
      ['-C', canonicalRoot, 'show', `${toolingMergeSha}:${relativeModulePath}`],
      { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }
    );
    const reviewedBytes = Buffer.isBuffer(reviewed.stdout)
      ? reviewed.stdout
      : Buffer.from(reviewed.stdout);
    if (sha256(reviewedBytes) !== descriptor.sha256)
      throw new Error(
        'evidence runner module differs from the reviewed commit'
      );
  } catch (error) {
    if (error instanceof Error && /evidence runner module/.test(error.message))
      throw error;
    throw new Error(
      'evidence runner module is not present in the reviewed commit'
    );
  }
  return Object.freeze({ path: canonicalPath, sha256: descriptor.sha256 });
}

/** Verifies a checked-in command entrypoint against the exact reviewed commit. */
export async function verifyReviewedEvidenceFile(
  workspaceRoot: string,
  toolingMergeSha: string,
  filePath: string
): Promise<Readonly<{ path: string; sha256: string }>> {
  if (!isAbsolute(workspaceRoot) || !isAbsolute(filePath))
    throw new Error('evidence tooling paths must be absolute');
  if (!TOOLING_SHA.test(toolingMergeSha))
    throw new Error('reviewed tooling merge SHA is invalid');
  const canonicalRoot = await realpath(workspaceRoot).catch(() => {
    throw new Error('evidence workspace root is not readable');
  });
  const lexicalPath = resolve(filePath);
  relativePath(canonicalRoot, lexicalPath);
  await assertNoSymlinkPath(canonicalRoot, lexicalPath);
  const canonicalPath = await realpath(filePath).catch(() => {
    throw new Error('evidence tooling file is not readable');
  });
  relativePath(canonicalRoot, canonicalPath);
  await assertNoSymlinkPath(canonicalRoot, canonicalPath);
  const stat = await lstat(canonicalPath);
  if (!stat.isFile()) throw new Error('evidence tooling file is not regular');
  const source = await readFile(canonicalPath);
  const sourceSha256 = sha256(source);
  const relativeFile = relativePath(canonicalRoot, canonicalPath);
  try {
    const tracked = await execFileAsync(
      'git',
      ['-C', canonicalRoot, 'ls-files', '--error-unmatch', '--', relativeFile],
      { encoding: 'utf8' }
    );
    if (tracked.stdout.trim() !== relativeFile)
      throw new Error('evidence tooling file is not tracked by git');
    const reviewed = await execFileAsync(
      'git',
      ['-C', canonicalRoot, 'show', `${toolingMergeSha}:${relativeFile}`],
      { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }
    );
    const reviewedBytes = Buffer.isBuffer(reviewed.stdout)
      ? reviewed.stdout
      : Buffer.from(reviewed.stdout);
    if (sha256(reviewedBytes) !== sourceSha256)
      throw new Error('evidence tooling file differs from the reviewed commit');
  } catch (error) {
    if (error instanceof Error && /evidence tooling file/.test(error.message))
      throw error;
    throw new Error(
      'evidence tooling file is not present in the reviewed commit'
    );
  }
  return Object.freeze({ path: canonicalPath, sha256: sourceSha256 });
}
