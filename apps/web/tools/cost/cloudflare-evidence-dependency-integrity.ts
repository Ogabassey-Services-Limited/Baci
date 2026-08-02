import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import {
  type FileHandle,
  lstat,
  open,
  readFile,
  realpath,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/;
const TOOLING_SHA = /^[a-f0-9]{40}$/;
const PACKAGE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;
export const EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST =
  'EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST';

export type EvidenceDependencyIntegrityManifest = Readonly<{
  toolingMergeSha: string;
  lockfileSha256: string;
  packages: Readonly<
    Record<
      string,
      Readonly<{
        root: string;
        files: Readonly<Record<string, string>>;
      }>
    >
  >;
}>;

export type ReviewedEvidenceDependencyManifest = Readonly<{
  path: string;
  manifest: EvidenceDependencyIntegrityManifest;
}>;

const hashBytes = (value: Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

function relativePath(root: string, file: string) {
  const path = relative(root, file);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error('evidence dependency path must be inside the workspace');
  return path.split(sep).join('/');
}

async function readPrivateManifest(path: string) {
  if (!isAbsolute(path) || resolve(path) !== path)
    throw new Error('dependency integrity manifest path must be canonical');
  const lexicalParent = await lstat(dirname(path)).catch(() => undefined);
  if (lexicalParent?.isSymbolicLink())
    throw new Error(
      'dependency integrity manifest parent must not be a symlink'
    );
  // Resolve only the parent: an OS-managed ancestor such as macOS /tmp may be
  // a symlink, while O_NOFOLLOW below must still reject a symlink at the final
  // manifest pathname itself.
  const canonicalParent = await realpath(dirname(path)).catch(() => {
    throw new Error('dependency integrity manifest parent is not readable');
  });
  const parent = await lstat(canonicalParent).catch(() => undefined);
  if (!parent || parent.isSymbolicLink() || !parent.isDirectory())
    throw new Error(
      'dependency integrity manifest parent is not private storage'
    );
  if ((parent.mode & 0o077) !== 0)
    throw new Error(
      'dependency integrity manifest parent is not private storage'
    );
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
      throw new Error(
        'dependency integrity manifest must be a private regular file'
      );
    const source = await handle.readFile();
    return {
      path,
      bytes: source,
      value: JSON.parse(source.toString('utf8')) as unknown,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('private regular'))
      throw error;
    throw new Error('dependency integrity manifest is not readable');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function validateManifest(value: unknown, toolingMergeSha: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('dependency integrity manifest is invalid');
  const candidate = value as {
    toolingMergeSha?: unknown;
    lockfileSha256?: unknown;
    packages?: unknown;
  };
  if (
    candidate.toolingMergeSha !== toolingMergeSha ||
    !SHA256.test(String(candidate.lockfileSha256)) ||
    !candidate.packages ||
    typeof candidate.packages !== 'object' ||
    Array.isArray(candidate.packages)
  )
    throw new Error('dependency integrity manifest authority is invalid');
  const packages: Record<
    string,
    { root: string; files: Record<string, string> }
  > = {};
  for (const [name, raw] of Object.entries(candidate.packages)) {
    if (!PACKAGE_NAME.test(name) || !raw || typeof raw !== 'object')
      throw new Error('dependency integrity manifest package is invalid');
    const packageValue = raw as { root?: unknown; files?: unknown };
    if (
      typeof packageValue.root !== 'string' ||
      !packageValue.root ||
      isAbsolute(packageValue.root) ||
      packageValue.root
        .split('/')
        .some((part) => part === '..' || part === '') ||
      !packageValue.files ||
      typeof packageValue.files !== 'object' ||
      Array.isArray(packageValue.files)
    )
      throw new Error('dependency integrity manifest package is invalid');
    const files: Record<string, string> = {};
    for (const [file, digest] of Object.entries(packageValue.files)) {
      if (
        !file ||
        file.startsWith('/') ||
        file.split('/').some((part) => part === '..' || part === '') ||
        !SHA256.test(String(digest))
      )
        throw new Error('dependency integrity manifest file is invalid');
      files[file] = String(digest);
    }
    if (!Object.keys(files).length)
      throw new Error('dependency integrity manifest package has no files');
    packages[name] = { root: packageValue.root, files };
  }
  return Object.freeze({
    toolingMergeSha,
    lockfileSha256: String(candidate.lockfileSha256),
    packages: Object.freeze(packages),
  });
}

async function reviewedLockfileBytes(root: string, toolingMergeSha: string) {
  try {
    const result = await execFileAsync(
      'git',
      ['-C', root, 'show', `${toolingMergeSha}:pnpm-lock.yaml`],
      { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 }
    );
    return Buffer.isBuffer(result.stdout)
      ? result.stdout
      : Buffer.from(result.stdout);
  } catch {
    throw new Error('reviewed pnpm lockfile is not present');
  }
}

export async function readReviewedEvidenceDependencyManifest(
  workspaceRoot: string,
  toolingMergeSha: string,
  path: string,
  reviewedManifestSha256: string
): Promise<ReviewedEvidenceDependencyManifest> {
  if (
    !isAbsolute(workspaceRoot) ||
    !TOOLING_SHA.test(toolingMergeSha) ||
    !SHA256.test(reviewedManifestSha256)
  )
    throw new Error('dependency integrity manifest authority is invalid');
  const canonicalRoot = await realpath(workspaceRoot).catch(() => {
    throw new Error('evidence workspace root is not readable');
  });
  const sealed = await readPrivateManifest(path);
  if (hashBytes(sealed.bytes) !== reviewedManifestSha256)
    throw new Error(
      'dependency integrity manifest does not match the reviewed authority'
    );
  const manifest = validateManifest(sealed.value, toolingMergeSha);
  const lockfilePath = resolve(canonicalRoot, 'pnpm-lock.yaml');
  const lockfileStat = await lstat(lockfilePath).catch(() => undefined);
  if (!lockfileStat || lockfileStat.isSymbolicLink() || !lockfileStat.isFile())
    throw new Error('current pnpm lockfile is not a regular file');
  const currentLockfile = await readFile(lockfilePath).catch(() => {
    throw new Error('current pnpm lockfile is not readable');
  });
  const reviewedLockfile = await reviewedLockfileBytes(
    canonicalRoot,
    toolingMergeSha
  );
  if (
    hashBytes(currentLockfile) !== manifest.lockfileSha256 ||
    hashBytes(reviewedLockfile) !== manifest.lockfileSha256
  )
    throw new Error(
      'dependency integrity manifest lockfile does not match the reviewed commit'
    );
  return Object.freeze({ path: sealed.path, manifest });
}

function packageRootFromPath(
  workspaceRoot: string,
  file: string,
  name: string
) {
  let current = dirname(file);
  while (current.startsWith(`${workspaceRoot}${sep}`)) {
    if (current.endsWith(`${sep}${name}`)) return current;
    current = dirname(current);
  }
  throw new Error(`bare package ${name} resolved outside the workspace`);
}

/** Verifies one canonical installed package file against the owner manifest. */
export async function verifyEvidenceDependencyFile(
  workspaceRoot: string,
  packageName: string,
  file: string,
  manifest: EvidenceDependencyIntegrityManifest
) {
  const canonicalWorkspaceRoot = await realpath(workspaceRoot).catch(() => {
    throw new Error('evidence workspace root is not readable');
  });
  const packageMetadata = manifest.packages[packageName];
  if (!packageMetadata)
    throw new Error(
      `bare package ${packageName} lacks reviewed integrity metadata`
    );
  const canonical = await realpath(file).catch(() => {
    throw new Error(`bare package ${packageName} is not readable`);
  });
  const packageRoot = await realpath(
    resolve(canonicalWorkspaceRoot, packageMetadata.root)
  ).catch(() => {
    throw new Error(`bare package ${packageName} root is not readable`);
  });
  if (
    packageRootFromPath(canonicalWorkspaceRoot, canonical, packageName) !==
    packageRoot
  )
    throw new Error(
      `bare package ${packageName} root does not match reviewed metadata`
    );
  const filePath = relativePath(packageRoot, canonical);
  const expected = packageMetadata.files[filePath];
  if (!expected)
    throw new Error(
      `bare package ${packageName} file lacks reviewed integrity metadata`
    );
  const stat = await lstat(canonical);
  if (!stat.isFile())
    throw new Error(`bare package ${packageName} file is not regular`);
  if (hashBytes(await readFile(canonical)) !== expected)
    throw new Error(
      `bare package ${packageName} bytes differ from reviewed integrity metadata`
    );
  return canonical;
}
