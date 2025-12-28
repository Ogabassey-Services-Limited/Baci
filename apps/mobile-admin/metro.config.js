/**
 * Metro Configuration for Expo Monorepo with pnpm
 * Enables resolution of shared packages from packages/
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root (Baci-app/)
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo root for changes (shared packages)
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages from
// Include both project and monorepo node_modules for pnpm
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Don't disable hierarchical lookup - pnpm needs it for nested deps
// config.resolver.disableHierarchicalLookup = true;

// 4. Handle pnpm symlinks properly
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
