import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readSourceInventory } from './event-pipeline-source-inventory';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

describe('readSourceInventory', () => {
  it('returns deleted paths as missing instead of throwing', () => {
    const root = mkdtempSync(join(tmpdir(), 'event-inventory-'));
    directories.push(root);
    writeFileSync(join(root, 'present.ts'), 'export {};');
    expect(readSourceInventory(root, ['present.ts', 'deleted.ts'])).toEqual({
      missingPaths: ['deleted.ts'],
      sources: new Map([['present.ts', 'export {};']]),
    });
  });
});
