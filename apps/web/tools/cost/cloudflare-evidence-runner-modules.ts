import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SHA256 = /^[a-f0-9]{64}$/;
const TOOLING_SHA = /^[a-f0-9]{40}$/;
const IMPORT_SPECIFIER =
  /\b(?:import|export)\s+(?:(?:[^'"`]*?)\sfrom\s+)?['"]([^'"]+)['"]|\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT = /\b(?:import|require)\s*\(([^)]*)\)/g;
const MODULE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
];
const BUILTIN_MODULES = new Set(builtinModules);

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

function importedSpecifiers(source: string) {
  for (const match of source.matchAll(DYNAMIC_IMPORT))
    if (!/^\s*(['"])[^'"\n]*\1\s*$/.test(match[1]))
      throw new Error('evidence runner module has a non-literal import');
  return [...source.matchAll(IMPORT_SPECIFIER)].map(
    (match) => match[1] ?? match[2]
  );
}

async function resolveLocalImport(from: string, specifier: string) {
  const requested = isAbsolute(specifier)
    ? specifier
    : resolve(dirname(from), specifier);
  const candidates = extname(requested)
    ? [requested]
    : [
        ...MODULE_EXTENSIONS.map((extension) => `${requested}${extension}`),
        ...MODULE_EXTENSIONS.slice(1).map(
          (extension) => `${requested}/index${extension}`
        ),
      ];
  for (const candidate of candidates) {
    try {
      if ((await lstat(candidate)).isFile()) return candidate;
    } catch {
      // Continue through the extension and index candidates.
    }
  }
  throw new Error('evidence runner module import is not a local file');
}

async function reviewedBytes(
  root: string,
  toolingMergeSha: string,
  relativeFile: string,
  label: string
) {
  try {
    const tracked = await execFileAsync(
      'git',
      ['-C', root, 'ls-files', '--error-unmatch', '--', relativeFile],
      { encoding: 'utf8' }
    );
    if (tracked.stdout.trim() !== relativeFile)
      throw new Error(`${label} is not tracked by git`);
    const reviewed = await execFileAsync(
      'git',
      ['-C', root, 'show', `${toolingMergeSha}:${relativeFile}`],
      { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }
    );
    return Buffer.isBuffer(reviewed.stdout)
      ? reviewed.stdout
      : Buffer.from(reviewed.stdout);
  } catch (error) {
    if (error instanceof Error && error.message.includes(label)) throw error;
    throw new Error(`${label} is not present in the reviewed commit`);
  }
}

async function verifyReviewedTrackedFile(
  root: string,
  toolingMergeSha: string,
  file: string,
  label: string,
  expectedSha256?: string
) {
  const lexicalPath = resolve(file);
  relativePath(root, lexicalPath);
  await assertNoSymlinkPath(root, lexicalPath);
  const canonicalPath = await realpath(file).catch(() => {
    throw new Error(`${label} is not readable`);
  });
  relativePath(root, canonicalPath);
  await assertNoSymlinkPath(root, canonicalPath);
  if (!(await lstat(canonicalPath)).isFile())
    throw new Error(
      label === 'evidence tooling file'
        ? 'evidence tooling file is not regular'
        : `${label} is not a regular file`
    );
  const source = await readFile(canonicalPath);
  if (expectedSha256 && sha256(source) !== expectedSha256)
    throw new Error(`${label} bytes do not match its reviewed hash`);
  const relativeFile = relativePath(root, canonicalPath);
  const reviewed = await reviewedBytes(
    root,
    toolingMergeSha,
    relativeFile,
    label
  );
  if (sha256(reviewed) !== sha256(source))
    throw new Error(`${label} differs from the reviewed commit`);
  return { path: canonicalPath, source };
}

async function verifyRunnerImportClosure(
  root: string,
  toolingMergeSha: string,
  entrypoint: string
) {
  const visited = new Set<string>([entrypoint]);
  const pending = [entrypoint];
  while (pending.length) {
    const current = pending.pop() as string;
    const source = await readFile(current, 'utf8');
    for (const specifier of importedSpecifiers(source)) {
      if (specifier.startsWith('node:') || BUILTIN_MODULES.has(specifier))
        continue;
      if (!specifier.startsWith('.') && !isAbsolute(specifier))
        throw new Error('evidence runner module imports an external module');
      const imported = await resolveLocalImport(current, specifier);
      const verified = await verifyReviewedTrackedFile(
        root,
        toolingMergeSha,
        imported,
        'evidence runner module'
      );
      if (!visited.has(verified.path)) {
        visited.add(verified.path);
        pending.push(verified.path);
      }
    }
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
  const verified = await verifyReviewedTrackedFile(
    canonicalRoot,
    toolingMergeSha,
    descriptor.path,
    'evidence runner module',
    descriptor.sha256
  );
  await verifyRunnerImportClosure(
    canonicalRoot,
    toolingMergeSha,
    verified.path
  );
  return Object.freeze({ path: verified.path, sha256: descriptor.sha256 });
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
  const verified = await verifyReviewedTrackedFile(
    canonicalRoot,
    toolingMergeSha,
    filePath,
    'evidence tooling file'
  );
  return Object.freeze({
    path: verified.path,
    sha256: sha256(verified.source),
  });
}
