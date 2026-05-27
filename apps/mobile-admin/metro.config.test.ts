import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type MetroConfig = {
  resolver: {
    blockList?: RegExp[];
  };
  watchFolders?: string[];
};

const require = createRequire(import.meta.url);
const metroConfig = require('./metro.config.js') as MetroConfig;

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

function isBlocked(filePath: string) {
  return (
    metroConfig.resolver.blockList?.some((pattern) => pattern.test(filePath)) ??
    false
  );
}

describe('Metro configuration', () => {
  it('watches required monorepo packages but not the giant root node_modules', () => {
    expect(metroConfig.watchFolders).toEqual(
      expect.arrayContaining([
        projectRoot,
        path.resolve(workspaceRoot, 'packages/shared'),
        path.resolve(workspaceRoot, 'packages/tiktok-business'),
      ])
    );
    expect(metroConfig.watchFolders).not.toContain(
      path.resolve(workspaceRoot, 'node_modules')
    );
  });

  it('blocks pnpm virtual store packages to prevent crawlers overloading', () => {
    const pnpmPackagePath = path.join(
      workspaceRoot,
      'node_modules',
      '.pnpm',
      'react@19.2.3',
      'node_modules',
      'react',
      'index.js'
    );

    expect(isBlocked(pnpmPackagePath)).toBe(true);
  });

  it('blocks massive directories that should not be crawled', () => {
    const blockedPaths = [
      path.join(workspaceRoot, '.git', 'objects', 'pack'),
      path.join(workspaceRoot, '.pnpm-store', 'v3'),
      path.join(workspaceRoot, 'apps', 'web', 'node_modules', 'react'),
    ];

    for (const blockedPath of blockedPaths) {
      expect(isBlocked(blockedPath)).toBe(true);
    }
  });
});
