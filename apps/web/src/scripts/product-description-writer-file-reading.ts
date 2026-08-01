import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_FILE_READ_CONCURRENCY } from './product-description-writer-inventory';

export async function listFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

export async function readFilesWithConcurrency(
  files: string[],
  concurrency = DEFAULT_FILE_READ_CONCURRENCY,
  reader: (path: string) => Promise<string> = (path) => readFile(path, 'utf8')
): Promise<string[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('File read concurrency must be a positive integer');
  }
  const contents = new Array<string>(files.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, files.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < files.length) {
        const index = nextIndex;
        nextIndex += 1;
        contents[index] = await reader(files[index]);
      }
    })
  );
  return contents;
}
