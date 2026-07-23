import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';

function assertRepositoryPath(repositoryPath: string): void {
  if (
    repositoryPath.startsWith('/') ||
    repositoryPath.includes('\\') ||
    repositoryPath.split('/').includes('..') ||
    path.posix.normalize(repositoryPath) !== repositoryPath
  ) {
    throw new Error(`Unsafe repository path: ${repositoryPath}`);
  }
}

export async function readBoundReplayReceipt<T>(
  workspaceRoot: string,
  binding: { path: string; sha256: string },
  label: string,
  schema: { parse(value: unknown): T }
): Promise<T> {
  const root = await realpath(path.resolve(workspaceRoot));
  assertRepositoryPath(binding.path);
  const resolved = await realpath(path.resolve(root, binding.path));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} resolves outside the workspace`);
  }
  const bytes = await readFile(resolved, 'utf8');
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== binding.sha256) {
    throw new Error(`${label} SHA-256 does not match the frozen binding`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  let value: T;
  try {
    value = schema.parse(parsed);
  } catch {
    throw new Error(`${label} does not satisfy its strict schema`);
  }
  if (canonicalReplayFixtureJson(value) !== bytes) {
    throw new Error(`${label} is not canonical compact JSON`);
  }
  return value;
}
