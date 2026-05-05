import { readdirSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../../app');

const ROUTE_MODULE_EXTENSION_PATTERN = /\.(ts|tsx|js|jsx)$/;
const EXPO_ROUTER_SPECIAL_FILES = new Set([
  '+html.ts',
  '+html.tsx',
  '+html.js',
  '+html.jsx',
  '+native-intent.ts',
  '+native-intent.tsx',
  '+native-intent.js',
  '+native-intent.jsx',
  '+not-found.ts',
  '+not-found.tsx',
  '+not-found.js',
  '+not-found.jsx',
]);
const EXPLICIT_STATIC_ROUTES = new Set([
  '(tabs)/account.tsx',
  '(tabs)/cart.tsx',
  '(tabs)/categories.tsx',
  '(tabs)/saved.tsx',
  '(tabs)/wallet.tsx',
  'auth/callback.tsx',
  'auth/login.tsx',
  'checkout.tsx',
  'notifications.tsx',
  'order-success.tsx',
  'profile/delete-account.tsx',
  'profile/edit.tsx',
  'search.tsx',
  'utilities/history.tsx',
]);

function collectModuleFiles(currentPath: string): string[] {
  return readdirSync(currentPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      return collectModuleFiles(entryPath);
    }

    if (!ROUTE_MODULE_EXTENSION_PATTERN.test(entry.name)) {
      return [];
    }

    const relativePath = path.relative(APP_ROOT, entryPath);
    return [relativePath.split(path.sep).join('/')];
  });
}

function isRouteFile(relativePath: string): boolean {
  const fileName = path.basename(relativePath);

  if (EXPO_ROUTER_SPECIAL_FILES.has(fileName)) {
    return true;
  }

  if (/^_layout\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return true;
  }

  if (/^index\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return true;
  }

  if (
    /^(?:\[[a-zA-Z0-9_-]+\]|\[\.\.\.[a-zA-Z0-9_-]+\]|\[\[\.\.\.[a-zA-Z0-9_-]+\]\])\.(ts|tsx|js|jsx)$/.test(
      fileName
    )
  ) {
    return true;
  }

  return EXPLICIT_STATIC_ROUTES.has(relativePath);
}

describe('app route tree safety', () => {
  it('keeps the expo-router app directory route-only', () => {
    const nonRouteFiles = collectModuleFiles(APP_ROOT).filter(
      (filePath) => !isRouteFile(filePath)
    );

    if (nonRouteFiles.length > 0) {
      throw new Error(
        [
          'Found non-route module files under apps/mobile-storefront/app:',
          ...nonRouteFiles.map((filePath) => `- ${filePath}`),
          '',
          'Move route tests to apps/mobile-storefront/__tests__/app/<route>/.',
          'Move reusable UI to components/, stateful hooks to hooks/, and pure helpers/config to lib/ or feature folders outside app/.',
          'Expo Router treats module files under app/ as route candidates, so app/ must stay route-only.',
        ].join('\n')
      );
    }

    expect(nonRouteFiles).toEqual([]);
  });
});
