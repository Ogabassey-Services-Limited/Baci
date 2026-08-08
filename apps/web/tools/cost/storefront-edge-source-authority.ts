import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

type SourceFile = Readonly<{
  bytes: Buffer;
  sourcePath: string;
}>;

type SourceAuthorityOptions = Readonly<{
  originMainSha: string;
  repoRoot: string;
  routeRoot: string;
  routingInputPaths: readonly string[];
}>;

const execFileAsync = promisify(execFile);

function isIncludedRouteSource(sourcePath: string) {
  return (
    /\.(?:css|ts|tsx)$/.test(sourcePath) &&
    !/\.(?:spec|test)\.(?:ts|tsx)$/.test(sourcePath)
  );
}

async function listCurrentRouteSources(
  repoRoot: string,
  directory: string
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error('source tree does not match the approved commit');
    if (entry.isDirectory())
      paths.push(...(await listCurrentRouteSources(repoRoot, path)));
    else if (entry.isFile()) {
      const sourcePath = relative(repoRoot, path).split(sep).join('/');
      if (isIncludedRouteSource(sourcePath)) paths.push(sourcePath);
    }
  }
  return paths.sort();
}

async function runGit(repoRoot: string, args: readonly string[]) {
  const result = await execFileAsync('git', ['-C', repoRoot, ...args], {
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  return Buffer.isBuffer(result.stdout)
    ? result.stdout
    : Buffer.from(result.stdout);
}

function parseGitTree(value: Buffer) {
  const entries = new Map<string, string>();
  for (const record of value.toString('utf8').split('\0').filter(Boolean)) {
    const tabIndex = record.indexOf('\t');
    const header = record.slice(0, tabIndex);
    const sourcePath = record.slice(tabIndex + 1);
    const match = header.match(/^\d+ blob ([a-f0-9]{40})$/);
    if (tabIndex < 0 || !match)
      throw new Error('source tree does not match the approved commit');
    entries.set(sourcePath, match[1]);
  }
  return entries;
}

function gitBlobOid(bytes: Buffer) {
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

async function readApprovedFile(
  repoRoot: string,
  sourcePath: string,
  expectedBlobOid: string | undefined
): Promise<SourceFile> {
  const target = resolve(repoRoot, sourcePath);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error('source authority input must be a regular file');
  const bytes = await readFile(target);
  // SHA-1 is used only to reproduce Git's native blob object ID. The inventory
  // digests the verified bytes with SHA-256 after this identity comparison.
  if (!expectedBlobOid || gitBlobOid(bytes) !== expectedBlobOid)
    throw new Error('source tree does not match the approved commit');
  return { bytes, sourcePath };
}

/** Reads routing bytes only after binding the complete input set to one commit. */
export async function readStorefrontEdgeSourceAuthority(
  options: SourceAuthorityOptions
) {
  const routeRoot = options.routeRoot.replace(/\/$/, '');
  try {
    const approvedTree = parseGitTree(
      await runGit(options.repoRoot, [
        'ls-tree',
        '-r',
        '-z',
        '--full-tree',
        options.originMainSha,
        '--',
        routeRoot,
        ...options.routingInputPaths,
      ])
    );
    const approvedRouteTree = [...approvedTree.keys()]
      .filter((sourcePath) => sourcePath.startsWith(`${routeRoot}/`))
      .filter(isIncludedRouteSource)
      .sort();
    const currentRouteTree = await listCurrentRouteSources(
      options.repoRoot,
      resolve(options.repoRoot, routeRoot)
    );
    if (JSON.stringify(approvedRouteTree) !== JSON.stringify(currentRouteTree))
      throw new Error('source tree does not match the approved commit');

    const [routeSources, routingInputSources] = await Promise.all([
      Promise.all(
        currentRouteTree.map((sourcePath) =>
          readApprovedFile(
            options.repoRoot,
            sourcePath,
            approvedTree.get(sourcePath)
          )
        )
      ),
      Promise.all(
        [...options.routingInputPaths]
          .sort()
          .map((sourcePath) =>
            readApprovedFile(
              options.repoRoot,
              sourcePath,
              approvedTree.get(sourcePath)
            )
          )
      ),
    ]);
    return { routeSources, routingInputSources };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'source tree does not match the approved commit'
    )
      throw error;
    throw new Error('source tree does not match the approved commit', {
      cause: error,
    });
  }
}
