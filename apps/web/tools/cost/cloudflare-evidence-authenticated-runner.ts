import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type {
  EvidenceRunnerModuleDescriptor,
  ReviewedEvidenceModuleSource,
} from './cloudflare-evidence-runner-modules';

const SHA256 = /^[a-f0-9]{64}$/;
const BUILTIN_MODULES = new Set(builtinModules);
const IMPORT_SPECIFIER =
  /\b(?:import|export)\s+(?:(?:[^'"`]*?)\sfrom\s+)?['"]([^'"]+)['"]|\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT = /\b(?:import|require)\s*\(([^)]*)\)/g;

function relativePath(root: string, file: string) {
  const path = relative(root, file);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error('evidence runner module must be inside the workspace');
  return path;
}

async function assertNoSymlinkPath(root: string, file: string) {
  if ((await lstat(root)).isSymbolicLink())
    throw new Error('evidence workspace root is not a real directory');
  let current = root;
  for (const segment of relativePath(root, file).split(sep)) {
    current = resolve(current, segment);
    if ((await lstat(current)).isSymbolicLink())
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

/** Verifies one owner-approved, post-merge, closed provider adapter file. */
export async function verifyAuthenticatedEvidenceRunnerModule(
  workspaceRoot: string,
  descriptor: EvidenceRunnerModuleDescriptor
): Promise<
  EvidenceRunnerModuleDescriptor & {
    files: readonly ReviewedEvidenceModuleSource[];
  }
> {
  if (
    !isAbsolute(workspaceRoot) ||
    !isAbsolute(descriptor.path) ||
    !SHA256.test(descriptor.sha256)
  )
    throw new Error('authenticated evidence runner descriptor is invalid');
  const root = await realpath(workspaceRoot).catch(() => {
    throw new Error('evidence workspace root is not readable');
  });
  const lexicalPath = resolve(descriptor.path);
  relativePath(root, lexicalPath);
  await assertNoSymlinkPath(root, lexicalPath);
  const path = await realpath(lexicalPath).catch(() => {
    throw new Error('evidence runner module is not readable');
  });
  relativePath(root, path);
  await assertNoSymlinkPath(root, path);
  if (!(await lstat(path)).isFile())
    throw new Error('evidence runner module is not a regular file');
  const source = await readFile(path);
  const actualSha256 = createHash('sha256').update(source).digest('hex');
  if (actualSha256 !== descriptor.sha256)
    throw new Error('evidence runner module bytes do not match owner approval');
  for (const specifier of importedSpecifiers(source.toString('utf8')))
    if (!specifier.startsWith('node:') && !BUILTIN_MODULES.has(specifier))
      throw new Error(
        'authenticated evidence runner module must have a closed single-file import graph'
      );
  return Object.freeze({
    path,
    sha256: descriptor.sha256,
    files: Object.freeze([
      Object.freeze({ path, source: new Uint8Array(source) }),
    ]),
  });
}
