const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro Configuration for Expo SDK 54+ Monorepo (2026 Elite Standard)
 *
 * Modified to explicitly handle resolution for pnpm monorepos
 * where some modules might not be correctly linked in sub-packages.
 */

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

const { transformer, resolver } = config;

// Configure SVG support
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.watchFolders = [workspaceRoot];

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  // Exclude test-only Node packages from the bundle (they use import.meta
  // which Hermes doesn't support).
  blockList: [/node_modules\/vite\//, /node_modules\/vitest\//],
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Explicitly alias core libraries to the workspace root to prevent duplication
  // and resolve issues where pnpm doesn't symlink to sub-packages correctly.
  extraNodeModules: {
    'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
    react: path.resolve(workspaceRoot, 'node_modules/react'),
    'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
    expo: path.resolve(workspaceRoot, 'node_modules/expo'),
    'expo-router': path.resolve(workspaceRoot, 'node_modules/expo-router'),
    'react-native-gesture-handler': path.resolve(
      workspaceRoot,
      'node_modules/react-native-gesture-handler'
    ),
    'react-native-reanimated': path.resolve(
      workspaceRoot,
      'node_modules/react-native-reanimated'
    ),
    'react-native-screens': path.resolve(
      workspaceRoot,
      'node_modules/react-native-screens'
    ),
    'react-native-safe-area-context': path.resolve(
      workspaceRoot,
      'node_modules/react-native-safe-area-context'
    ),
  },
  // Critical for PNPM monorepos to resolve symlinked packages
  unstable_enableSymlinks: true,
  // 2026: Enable package exports as very new versions of native modules often require it
  unstable_enablePackageExports: true,
};

module.exports = config;
