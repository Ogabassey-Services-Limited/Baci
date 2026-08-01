import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listFiles,
  readFilesWithConcurrency,
} from './product-description-writer-file-reading';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('product description writer file reading', () => {
  it('preserves input order while bounding reads', async () => {
    const files = ['one', 'two', 'three'];
    await expect(
      readFilesWithConcurrency(files, 2, async (file) => file.toUpperCase())
    ).resolves.toEqual(['ONE', 'TWO', 'THREE']);
  });

  it('never exceeds the requested read concurrency', async () => {
    const files = ['one', 'two', 'three'];
    const releases: Array<() => void> = [];
    let inFlight = 0;
    let peak = 0;
    const result = readFilesWithConcurrency(files, 2, async (file) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise<void>((resolve) => releases.push(resolve));
      inFlight -= 1;
      return file;
    });

    expect(releases).toHaveLength(2);
    releases.splice(0, 2).forEach((release) => release());
    await Promise.resolve();
    await Promise.resolve();

    expect(releases).toHaveLength(1);
    expect(peak).toBe(2);
    releases[0]();
    await expect(result).resolves.toEqual(files);
  });

  it.each([0, -1, 1.5])(
    'rejects a non-positive or non-integer concurrency value: %s',
    async (concurrency) => {
      await expect(readFilesWithConcurrency([], concurrency)).rejects.toThrow(
        'File read concurrency must be a positive integer'
      );
    }
  );

  it('returns an empty result for an empty file list', async () => {
    await expect(readFilesWithConcurrency([])).resolves.toEqual([]);
  });

  it('lists files recursively in nested directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'baci-description-files-'));
    roots.push(root);
    await mkdir(join(root, 'nested', 'deeper'), { recursive: true });
    await writeFile(join(root, 'root.ts'), 'root');
    await writeFile(join(root, 'nested', 'deeper', 'leaf.ts'), 'leaf');

    await expect(listFiles(root)).resolves.toEqual([
      join(root, 'nested', 'deeper', 'leaf.ts'),
      join(root, 'root.ts'),
    ]);
  });

  it('returns an empty result for a missing root', async () => {
    await expect(listFiles('/tmp/baci-description-root-that-is-missing')).resolves.toEqual([]);
  });
});
