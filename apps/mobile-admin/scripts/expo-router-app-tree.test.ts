import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appDirectory = path.resolve(__dirname, '../app');

function walkFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return walkFiles(fullPath);
    }
    return fullPath;
  });
}

describe('walkFiles helper', () => {
  it('returns only file paths in a directory tree', () => {
    const filePaths = walkFiles(appDirectory);

    expect(filePaths.length).toBeGreaterThan(0);
    expect(filePaths.every((filePath) => typeof filePath === 'string')).toBe(
      true
    );
    expect(
      filePaths.every((filePath) => !statSync(filePath).isDirectory())
    ).toBe(true);
  });
});

describe('Expo Router app tree', () => {
  it('does not contain helper-only files that Expo Router would parse as routes', () => {
    const allFiles = walkFiles(appDirectory);

    const helperRouteFiles = allFiles
      .map((filePath) => path.relative(appDirectory, filePath))
      .filter(
        (filePath) =>
          filePath.endsWith('.styles.ts') ||
          path.basename(filePath).startsWith('VariantConditionEditor.')
      );

    expect(helperRouteFiles).toEqual([]);
  });
});
