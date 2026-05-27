import path from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';

// Metro does not expose these resolver types for its JS config, so mirror only the tested shape.
type MetroResolution = {
  filePath: string;
  type: string;
};

type MetroResolveRequest = (
  context: unknown,
  moduleName: string,
  platform: string | null
) => MetroResolution;

type MetroResolver = (
  context: { resolveRequest: MetroResolveRequest },
  moduleName: string,
  platform: string | null
) => MetroResolution;

jest.mock('expo/metro-config', () => ({
  getDefaultConfig: () => ({
    resolver: {},
  }),
}));

const metroConfig = jest.requireActual<{
  resolver: { blockList?: RegExp[]; resolveRequest?: MetroResolver };
  watchFolders?: string[];
}>('./metro.config.js');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

function getResolver(): MetroResolver {
  const resolveRequest = metroConfig.resolver.resolveRequest;

  expect(resolveRequest).toEqual(expect.any(Function));
  if (!resolveRequest) {
    throw new Error('Expected Metro to define a custom dependency resolver.');
  }

  return resolveRequest;
}

describe('Metro web runtime resolution', () => {
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

    expect(
      metroConfig.resolver.blockList?.some((pattern) =>
        pattern.test(pnpmPackagePath)
      )
    ).toBe(false);
  });

  it('resolves Zustand middleware to its classic-script-safe build on web', () => {
    const fallbackResolve = jest.fn<MetroResolveRequest>(() => ({
      filePath: '/fallback.js',
      type: 'sourceFile',
    }));

    const resolution = getResolver()(
      { resolveRequest: fallbackResolve },
      'zustand/middleware',
      'web'
    );

    expect(resolution).toEqual({
      filePath: require.resolve('zustand/middleware'),
      type: 'sourceFile',
    });
    expect(fallbackResolve).not.toHaveBeenCalled();
  });

  it.each([
    'ios',
    'android',
  ])('preserves default Zustand middleware resolution on %s', (platform) => {
    const fallbackResolution = {
      filePath: '/fallback.js',
      type: 'sourceFile',
    };
    const fallbackResolve = jest.fn<MetroResolveRequest>(
      () => fallbackResolution
    );

    const resolution = getResolver()(
      { resolveRequest: fallbackResolve },
      'zustand/middleware',
      platform
    );

    expect(resolution).toBe(fallbackResolution);
    expect(fallbackResolve).toHaveBeenCalledWith(
      expect.any(Object),
      'zustand/middleware',
      platform
    );
  });

  it('preserves default resolution for unrelated web modules', () => {
    const fallbackResolution = {
      filePath: '/fallback.js',
      type: 'sourceFile',
    };
    const fallbackResolve = jest.fn<MetroResolveRequest>(
      () => fallbackResolution
    );

    const resolution = getResolver()(
      { resolveRequest: fallbackResolve },
      'react',
      'web'
    );

    expect(resolution).toBe(fallbackResolution);
    expect(fallbackResolve).toHaveBeenCalledWith(
      expect.any(Object),
      'react',
      'web'
    );
  });
});
