import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function writeProtectedMergeIdentity(
  path: string,
  mergeSha: string
) {
  await writeFile(
    path,
    JSON.stringify({
      reviewedHeadSha: 'd'.repeat(40),
      requiredChecksSha: 'e'.repeat(40),
      mergeSha,
      mergeMethod: 'squash',
      protectedRef: `refs/tags/storefront-ogabassey-rollout-${mergeSha}-${'f'.repeat(16)}`,
      protectedRefTargetSha: mergeSha,
      protectedTagObjectSha: '1'.repeat(40),
      reviewId: 'review-123',
      reviewAuthor: 'reviewer',
      requiredCheckRunIds: ['123'],
      requiredCheckNames: ['Build'],
      artifactManifestSha256: 'a'.repeat(64),
    }),
    { mode: 0o600 }
  );
}

async function packageFiles(root: string, directory = root) {
  const files: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await packageFiles(root, path));
      continue;
    }
    if (!entry.isFile()) continue;
    files[relative(root, path).split('/').join('/')] = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  }
  return files;
}

export async function writeEvidenceDependencyIntegrityManifest(
  path: string,
  workspaceRoot: string,
  toolingMergeSha: string,
  packageNames: readonly string[]
) {
  const canonicalWorkspaceRoot = await realpath(workspaceRoot);
  const packages: Record<string, unknown> = {};
  for (const packageName of packageNames) {
    const packageRoot = await realpath(
      join(canonicalWorkspaceRoot, 'node_modules', packageName)
    );
    packages[packageName] = {
      root: relative(canonicalWorkspaceRoot, packageRoot).split('/').join('/'),
      files: await packageFiles(packageRoot),
    };
  }
  const lockfile = await readFile(
    join(canonicalWorkspaceRoot, 'pnpm-lock.yaml')
  );
  await writeFile(
    path,
    JSON.stringify({
      toolingMergeSha,
      lockfileSha256: createHash('sha256').update(lockfile).digest('hex'),
      packages,
    }),
    { mode: 0o600 }
  );
}

export async function createEvidenceDependencyIntegrityManifest(
  workspaceRoot: string,
  toolingMergeSha: string,
  packageNames: readonly string[]
) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-evidence-manifest-'));
  const path = join(directory, 'dependency-integrity.json');
  await writeEvidenceDependencyIntegrityManifest(
    path,
    workspaceRoot,
    toolingMergeSha,
    packageNames
  );
  return path;
}

export async function readEvidenceToolingHead(workspaceRoot: string) {
  const { stdout } = await execFileAsync('git', [
    '-C',
    workspaceRoot,
    'rev-parse',
    '--verify',
    'HEAD',
  ]);
  return stdout.trim();
}
