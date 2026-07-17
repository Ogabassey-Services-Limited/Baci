import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { readGitObjectBytes } from './read-git-object-bytes';

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('readGitObjectBytes', () => {
  it('rejects option-like object specifications before invoking Git', async () => {
    await expect(readGitObjectBytes(process.cwd(), '--help')).rejects.toThrow(
      'Unsafe Git object spec'
    );
  });

  it('preserves non-UTF-8 Git object bytes exactly', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-git-bytes-'));
    temporaryRoots.push(root);
    const body = Buffer.from([0x00, 0x7f, 0x80, 0xc3, 0x28, 0xff, 0x0a]);
    const fixture = path.join(root, 'binary-fixture');
    await writeFile(fixture, body);
    await execFileAsync('git', ['init', '--quiet', root]);
    const { stdout } = await execFileAsync('git', [
      '-C',
      root,
      'hash-object',
      '-w',
      'binary-fixture',
    ]);

    await expect(readGitObjectBytes(root, stdout.trim())).resolves.toEqual(
      body
    );
  });

  it('ignores replacement refs when reading a bound Git object', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-git-replace-'));
    temporaryRoots.push(root);
    await execFileAsync('git', ['init', '--quiet', root]);
    await writeFile(path.join(root, 'original'), 'original bytes\n');
    await writeFile(path.join(root, 'replacement'), 'replacement bytes\n');
    const { stdout: originalObject } = await execFileAsync('git', [
      '-C',
      root,
      'hash-object',
      '-w',
      'original',
    ]);
    const { stdout: replacementObject } = await execFileAsync('git', [
      '-C',
      root,
      'hash-object',
      '-w',
      'replacement',
    ]);
    await execFileAsync('git', [
      '-C',
      root,
      'replace',
      originalObject.trim(),
      replacementObject.trim(),
    ]);

    await expect(
      readGitObjectBytes(root, originalObject.trim())
    ).resolves.toEqual(Buffer.from('original bytes\n'));
  });

  it('sanitizes errors for nonexistent bound objects', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-git-missing-'));
    temporaryRoots.push(root);
    await execFileAsync('git', ['init', '--quiet', root]);

    await expect(readGitObjectBytes(root, 'f'.repeat(40))).rejects.toThrow(
      /^git show failed$/
    );
  });
});
