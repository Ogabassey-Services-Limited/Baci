/**
 * Metro Configuration for Expo SDK 54+ Monorepo
 *
 * IMPORTANT: Since Expo SDK 52, Metro automatically configures itself for monorepos.
 * Manual overrides of watchFolders, nodeModulesPaths, extraNodeModules can CONFLICT
 * with Expo's automatic setup. This minimal config lets Expo handle resolution.
 *
 * Reference: https://docs.expo.dev/guides/monorepos/
 */

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable stable symlink support (required for pnpm)
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
