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

function resolvePackageRoot(packageName) {
  const projectPackageRoot = path.resolve(projectRoot, 'node_modules', packageName);

  try {
    require.resolve(path.join(projectPackageRoot, 'package.json'));
    return projectPackageRoot;
  } catch {
    return path.resolve(workspaceRoot, 'node_modules', packageName);
  }
}

const reactPackageRoot = resolvePackageRoot('react');
const reactDomPackageRoot = resolvePackageRoot('react-dom');
const reactNativePackageRoot = resolvePackageRoot('react-native');
const expoPackageRoot = resolvePackageRoot('expo');
const expoRouterPackageRoot = resolvePackageRoot('expo-router');

config.watchFolders = [workspaceRoot];
config.resolver = {
  ...resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Prefer the app-local core packages first so release bundles stay version-aligned.
  extraNodeModules: {
    'react-native': reactNativePackageRoot,
    react: reactPackageRoot,
    'react-dom': reactDomPackageRoot,
    expo: expoPackageRoot,
    'expo-router': expoRouterPackageRoot,
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
  // Force all React resolutions to the app-selected React package so Metro
  // cannot accidentally mix the hoisted workspace copy with the app bundle.
  resolveRequest: (context, moduleName, platform) => {
    // M27 fix: Wrap in try-catch to prevent metro bundler crash
    // when react-dom or subpath cannot be resolved (e.g. missing package)
    try {
      let forcedRoot = null;

      if (moduleName === 'react') {
        forcedRoot = reactPackageRoot;
      } else if (moduleName === 'react-dom') {
        forcedRoot = reactDomPackageRoot;
      } else if (moduleName.startsWith('react/')) {
        forcedRoot = path.resolve(
          reactPackageRoot,
          moduleName.slice('react/'.length)
        );
      } else if (moduleName.startsWith('react-dom/')) {
        forcedRoot = path.resolve(
          reactDomPackageRoot,
          moduleName.slice('react-dom/'.length)
        );
      }

      if (forcedRoot) {
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
