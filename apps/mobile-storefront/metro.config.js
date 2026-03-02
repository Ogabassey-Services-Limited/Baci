/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro Configuration for Expo SDK 54+ Monorepo (2026 Elite Standard)
 *
 * Since Expo SDK 52, Metro automatically configures itself for monorepos.
 * We now explicitly configure watchFolders and nodeModulesPaths to ensure
 * core dependencies are resolved from the root node_modules.
 *
 * CRITICAL: blockList prevents bundling of Node.js-only modules (vite, vitest, esbuild, etc)
 * which cause Hermes runtime errors with import.meta syntax.
 */

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

const { resolver } = config;

config.watchFolders = [workspaceRoot];
config.resolver = {
  ...resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Explicitly alias core libraries to the workspace root to prevent duplication
  extraNodeModules: {
    'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
    react: path.resolve(workspaceRoot, 'node_modules/react'),
    'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
    expo: path.resolve(workspaceRoot, 'node_modules/expo'),
    'expo-router': path.resolve(workspaceRoot, 'node_modules/expo-router'),
  },
  // Critical for PNPM monorepos to resolve symlinked packages
  unstable_enableSymlinks: true,
  // 2026: Enable package exports as it is now the standard for modern libraries
  unstable_enablePackageExports: false,
  // Block test files and Node.js-only modules from being bundled by Metro.
  // This prevents Hermes runtime errors when build tool dependencies pull in
  // modules that use import.meta syntax (which is Node.js-only).
  blockList: [
    // Test files should not be bundled
    /\.test\.tsx?$/,
    /\.spec\.tsx?$/,
    /\/__tests__\//,
    // Test configuration files
    /vitest\.config\.ts$/,
    /jest\.config\.js$/,
    /jest\.setup\.ts$/,
    // Node.js-only modules that cause Hermes errors
    // vite and vitest are dev-only and shouldn't be in the bundle anyway
    /node_modules[\\/]vite[\\/]/,
    /node_modules[\\/]vitest[\\/]/,
    /node_modules[\\/]@vitejs[\\/]/,
    // Other Node.js-only modules commonly pulled by build tools
    /node_modules[\\/]esbuild[\\/]/,
  ],
  // Force ALL React resolutions to the single workspace root copy
  // This prevents nested node_modules (expo-keep-awake, expo-modules-core, etc.)
  // from loading their own React 19.2.4 alongside the app's React 19.1.0
  resolveRequest: (context, moduleName, platform) => {
    // M27 fix: Wrap in try-catch to prevent metro bundler crash
    // when react-dom or subpath cannot be resolved (e.g. missing package)
    try {
      if (
        moduleName === 'react' ||
        moduleName === 'react-dom' ||
        moduleName.startsWith('react/') ||
        moduleName.startsWith('react-dom/')
      ) {
        const forcedRoot = path.resolve(
          workspaceRoot,
          'node_modules',
          moduleName
        );
        return {
          filePath: require.resolve(forcedRoot),
          type: 'sourceFile',
        };
      }
    } catch {
      // If resolution fails (e.g. react-dom not installed for RN),
      // fall through to default resolution
    }
    // Fall back to default resolution for everything else
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
