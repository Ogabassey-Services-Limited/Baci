import { createHash, randomBytes } from 'node:crypto';
import { constants, realpathSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { ReplaySource } from './supabase-history-replay-types';

const sha256 = (value: Buffer) =>
  createHash('sha256').update(value).digest('hex');

function isWithin(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

async function canonicalReplaySourcePath(
  repositoryRoot: string,
  repositoryPath: string
): Promise<string> {
  try {
    const canonicalRoot = await fs.realpath(repositoryRoot);
    const source = await fs.realpath(
      replayRepositoryPath(canonicalRoot, repositoryPath)
    );
    if (!isWithin(canonicalRoot, source)) throw new Error('escape');
    return source;
  } catch {
    throw new Error('Unsafe replay source path');
  }
}

async function readReplaySource(
  repositoryRoot: string,
  repositoryPath: string
): Promise<Buffer> {
  const source = await canonicalReplaySourcePath(
    repositoryRoot,
    repositoryPath
  );
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
    return await handle.readFile();
  } catch {
    throw new Error('Unsafe replay source path');
  } finally {
    await handle?.close();
  }
}

function replayRepositoryRoot(moduleDirectory: string): string {
  if (!path.isAbsolute(moduleDirectory)) {
    throw new Error('Replay module directory must be absolute');
  }
  return realpathSync(
    path.resolve(realpathSync(moduleDirectory), '../../../..')
  );
}

function replayRepositoryPath(
  repositoryRoot: string,
  repositoryPath: string
): string {
  if (
    !path.isAbsolute(repositoryRoot) ||
    !repositoryPath ||
    repositoryPath.startsWith('/') ||
    repositoryPath.includes('\\') ||
    repositoryPath.split('/').includes('..') ||
    path.posix.normalize(repositoryPath) !== repositoryPath
  ) {
    throw new Error('Unsafe replay repository path');
  }
  const resolved = path.resolve(repositoryRoot, repositoryPath);
  if (
    resolved !== repositoryRoot &&
    !resolved.startsWith(`${repositoryRoot}${path.sep}`)
  ) {
    throw new Error('Unsafe replay repository path');
  }
  return resolved;
}

type ResolvedReplayOutput = {
  canonicalParent: string;
  canonicalRoot: string;
  lexicalParent: string;
  path: string;
};

async function resolveReplayOutput(
  repositoryRoot: string,
  repositoryPath: string
): Promise<ResolvedReplayOutput> {
  const canonicalRoot = await fs.realpath(repositoryRoot);
  let resolved: string;
  try {
    resolved = replayRepositoryPath(canonicalRoot, repositoryPath);
  } catch {
    throw new Error('Unsafe replay output path');
  }
  const canonicalParent = await fs
    .realpath(path.dirname(resolved))
    .catch(() => {
      throw new Error('Unsafe replay output path');
    });
  if (!isWithin(canonicalRoot, canonicalParent)) {
    throw new Error('Unsafe replay output path');
  }
  const target = path.join(canonicalParent, path.basename(resolved));
  const targetStat = await fs
    .lstat(target)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw new Error('Unsafe replay output path');
    });
  if (targetStat?.isSymbolicLink()) {
    throw new Error('Unsafe replay output path');
  }
  return {
    canonicalParent,
    canonicalRoot,
    lexicalParent: path.dirname(resolved),
    path: target,
  };
}

export type ReplayOutputWriteOptions = {
  encoding?: BufferEncoding;
  mode?: number;
};

export type ReplayOutput = {
  create(
    bytes: string | Uint8Array,
    options?: ReplayOutputWriteOptions
  ): Promise<void>;
  path: string;
  read(encoding?: BufferEncoding): Promise<Buffer | string>;
  remove(): Promise<void>;
  replace(
    bytes: string | Uint8Array,
    options?: ReplayOutputWriteOptions
  ): Promise<void>;
};

async function assertReplayOutputSafe(
  output: ResolvedReplayOutput
): Promise<void> {
  const currentParent = await fs.realpath(output.lexicalParent).catch(() => {
    throw new Error('Unsafe replay output path');
  });
  if (
    currentParent !== output.canonicalParent ||
    !isWithin(output.canonicalRoot, currentParent)
  ) {
    throw new Error('Unsafe replay output path');
  }
  const targetStat = await fs
    .lstat(output.path)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw new Error('Unsafe replay output path');
    });
  if (targetStat?.isSymbolicLink()) {
    throw new Error('Unsafe replay output path');
  }
}

async function replayOutput(
  repositoryRoot: string,
  repositoryPath: string
): Promise<ReplayOutput> {
  const output = await resolveReplayOutput(repositoryRoot, repositoryPath);
  return {
    create: async (bytes, options = {}) => {
      await assertReplayOutputSafe(output);
      try {
        await fs.writeFile(output.path, bytes, {
          ...options,
          flag: 'wx',
        });
      } catch {
        throw new Error('Replay output create failed or output exists');
      }
      try {
        await assertReplayOutputSafe(output);
      } catch (error) {
        await fs.rm(output.path, { force: true });
        throw error;
      }
    },
    path: output.path,
    read: async (encoding) => {
      await assertReplayOutputSafe(output);
      let handle: fs.FileHandle | undefined;
      try {
        handle = await fs.open(
          output.path,
          constants.O_RDONLY | constants.O_NOFOLLOW
        );
        return encoding
          ? await handle.readFile({ encoding })
          : await handle.readFile();
      } catch {
        throw new Error('Unsafe replay output path');
      } finally {
        await handle?.close();
      }
    },
    remove: async () => {
      await assertReplayOutputSafe(output);
      await fs.rm(output.path);
    },
    replace: async (bytes, options = {}) => {
      await assertReplayOutputSafe(output);
      const temporary = `${output.path}.${randomBytes(8).toString('hex')}.tmp`;
      try {
        await fs.writeFile(temporary, bytes, { ...options, flag: 'wx' });
        await assertReplayOutputSafe(output);
        await fs.rename(temporary, output.path);
      } catch (error) {
        await fs.rm(temporary, { force: true });
        if (
          error instanceof Error &&
          error.message === 'Unsafe replay output path'
        ) {
          throw error;
        }
        throw new Error('Replay output replace failed');
      }
    },
  };
}

async function copyReplayBootstrapSource(
  repositoryRoot: string,
  workdir: string,
  source: ReplaySource
): Promise<void> {
  const target = path.join(
    workdir,
    'supabase/migrations',
    path.posix.basename(source.repositoryPath)
  );
  const bytes = await readReplaySource(repositoryRoot, source.repositoryPath);
  if (sha256(bytes) !== source.sha256) {
    throw new Error('Replay source hash mismatch');
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes, { flag: 'wx' });
}

async function materializeSupabaseReplaySource(
  repositoryRoot: string,
  workdir: string,
  source: ReplaySource,
  ordinal: number
): Promise<string> {
  const original = await readReplaySource(
    repositoryRoot,
    source.repositoryPath
  );
  let body = original;
  if (source.transform) {
    const { originalSha256, outputSha256, replacement, search } =
      source.transform;
    const text = original.toString('utf8');
    if (
      sha256(original) !== originalSha256 ||
      text.split(search).length !== 2
    ) {
      throw new Error('Replay source transform mismatch');
    }
    body = Buffer.from(text.replace(search, replacement));
    if (sha256(body) !== outputSha256) {
      throw new Error('Replay source transform mismatch');
    }
  } else if (sha256(original) !== source.sha256) {
    throw new Error('Replay source hash mismatch');
  }
  const target = path.join(
    workdir,
    'sql',
    `${ordinal}-${path.posix.basename(source.repositoryPath)}`
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body, { flag: 'wx' });
  return target;
}

export const replayRepository = {
  copyBootstrapSource: copyReplayBootstrapSource,
  materializeSource: materializeSupabaseReplaySource,
  output: replayOutput,
  path: replayRepositoryPath,
  readSource: readReplaySource,
  root: replayRepositoryRoot,
  source: canonicalReplaySourcePath,
};
