/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro Configuration for Expo SDK 54+ Monorepo (2026 Elite Standard)
 *
 * Since Expo SDK 52, Metro automatically configures itself for monorepos.
 * We now explicitly configure watchFolders and nodeModulesPaths to ensure
 * core dependencies are resolved from the root node_modules.
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
  unstable_enablePackageExports: true,
};

module.exports = config;
