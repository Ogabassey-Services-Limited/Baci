import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayRepository } from './replay-repository-root';

describe('ReplayOutput.remove', () => {
  it('removes an ordinary in-repository output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-output-remove-root-'));
    try {
      await mkdir(path.join(root, 'fixtures'));
      const output = await replayRepository.output(
        root,
        'fixtures/result.json'
      );
      await output.create('safe');

      await output.remove();

      await expect(readFile(output.path)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects removal after the lexical parent is redirected outside', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-output-remove-root-'));
    const outside = await mkdtemp(
      path.join(tmpdir(), 'baci-output-remove-outside-')
    );
    try {
      const parent = path.join(root, 'fixtures');
      await mkdir(parent);
      const output = await replayRepository.output(
        root,
        'fixtures/result.json'
      );
      await output.create('inside');
      await writeFile(path.join(outside, 'result.json'), 'outside');
      await rm(parent, { recursive: true });
      await symlink(outside, parent, 'dir');

      await expect(output.remove()).rejects.toThrow(
        /^Unsafe replay output path$/
      );
      await expect(
        readFile(path.join(outside, 'result.json'), 'utf8')
      ).resolves.toBe('outside');
    } finally {
      await Promise.all([
        rm(root, { force: true, recursive: true }),
        rm(outside, { force: true, recursive: true }),
      ]);
    }
  });
});
