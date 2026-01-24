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

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  unstable_enableSymlinks: true,
};

module.exports = config;
