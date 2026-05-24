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
const gestureHandlerPackageRoot = resolvePackageRoot('react-native-gesture-handler');
const reanimatedPackageRoot = resolvePackageRoot('react-native-reanimated');
const screensPackageRoot = resolvePackageRoot('react-native-screens');
const safeAreaContextPackageRoot = resolvePackageRoot('react-native-safe-area-context');

config.watchFolders = [workspaceRoot];
config.resolver = {
  ...resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Prefer the app-local core packages first so release bundles stay version-aligned.
  extraNodeModules: {
    '@baci/shared': path.resolve(workspaceRoot, 'packages/shared'),
    'react-native': reactNativePackageRoot,
    react: reactPackageRoot,
    'react-dom': reactDomPackageRoot,
    expo: expoPackageRoot,
    'expo-router': expoRouterPackageRoot,
    'react-native-gesture-handler': gestureHandlerPackageRoot,
    'react-native-reanimated': reanimatedPackageRoot,
    'react-native-screens': screensPackageRoot,
    'react-native-safe-area-context': safeAreaContextPackageRoot,
  },
  // 2026: Enable package exports so shared-package subpath imports resolve the
  // same way in Metro as they do in the rest of the monorepo.
  unstable_enablePackageExports: true,
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
};

module.exports = config;
