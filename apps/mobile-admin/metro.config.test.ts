import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type MetroConfig = {
  resolver: {
    blockList?: RegExp[];
  };
  serializer?: {
    customSerializer?: unknown;
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
  it('watches root node_modules so pnpm hoisted dependencies resolve', () => {
    expect(metroConfig.watchFolders).toEqual(
      expect.arrayContaining([
        projectRoot,
        path.resolve(workspaceRoot, 'node_modules'),
        path.resolve(workspaceRoot, 'packages/shared'),
        path.resolve(workspaceRoot, 'packages/tiktok-business'),
      ])
    );
  });

  it('keeps the PostHog Metro serializer enabled for source-map debug ids', () => {
    expect(metroConfig.serializer?.customSerializer).toEqual(
      expect.any(Function)
    );
  });

  it('does not block pnpm virtual store packages', () => {
    const pnpmPackagePath = path.join(
      workspaceRoot,
      'node_modules',
      '.pnpm',
      'react@19.2.3',
      'node_modules',
      'react',
      'index.js'
    );

    expect(isBlocked(pnpmPackagePath)).toBe(false);
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

  it('blocks colocated test helper modules from the Expo Router bundle', () => {
    const testHelperPaths = [
      path.join(
        projectRoot,
        'app',
        '(admin)',
        'analytics-config.test-support.ts'
      ),
      path.join(projectRoot, 'app', '(admin)', 'social-media.test-harness.ts'),
      path.join(
        projectRoot,
        'app',
        '(admin)',
        '(tabs)',
        'home.test-helper.tsx'
      ),
    ];

    for (const testHelperPath of testHelperPaths) {
      expect(isBlocked(testHelperPath)).toBe(true);
    }

    expect(
      isBlocked(path.join(projectRoot, 'components', 'ShippingProvider.tsx'))
    ).toBe(false);
    expect(
      isBlocked(
        path.join(projectRoot, 'app', '(admin)', 'analytics-config.helper.ts')
      )
    ).toBe(false);
  });
});
