import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';

const tabRouteDirectory = join(__dirname, '../../app/(tabs)');

describe('tab route architecture', () => {
  it('keeps wallet helper modules out of the tab route directory', () => {
    if (!existsSync(tabRouteDirectory)) {
      throw new Error(
        `Expected tab route directory to exist: ${tabRouteDirectory}`
      );
    }

    const tabRouteFiles = readdirSync(tabRouteDirectory);

    expect(
      tabRouteFiles.filter((fileName) =>
        /^wallet\.(?!test\.)([a-z0-9-]+)\.(ts|tsx|js|jsx)$/.test(fileName)
      )
    ).toEqual([]);
  });
});
