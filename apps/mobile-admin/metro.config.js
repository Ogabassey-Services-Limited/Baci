const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro Configuration for Expo SDK 54+ Monorepo (2026 Elite Standard)
 *
 * Modified to explicitly handle resolution for pnpm monorepos
 * where some modules might not be correctly linked in sub-packages.
 *
 * CRITICAL: blockList prevents bundling of Node.js-only modules (vite, vitest, etc)
 * which cause Hermes runtime errors with import.meta syntax.
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

// Prevent Metro from bundling test files and Node.js-only modules.
// This resolves Hermes errors with vite/vitest pulling in import.meta syntax.
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Explicitly alias core libraries to the workspace root to prevent duplication
  // and resolve issues where pnpm doesn't symlink to sub-packages correctly.
  extraNodeModules: {
    '@baci/shared': path.resolve(workspaceRoot, 'packages/shared'),
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
  // Block test files and Node.js-only modules from being bundled by Metro.
  // This prevents Hermes runtime errors when vite/vitest dependencies pull in
  // modules that use import.meta syntax (which is Node.js-only).
  blockList: [
    // Test files should not be bundled
    /\.test\.tsx?$/,
    /\.spec\.tsx?$/,
    /\/__tests__\//,
    // Test configuration files
    /vitest\.config\.ts$/,
    /jest\.config\.js$/,
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
