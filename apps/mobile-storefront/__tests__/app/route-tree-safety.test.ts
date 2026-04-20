import { readdirSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../../app');
const DISALLOWED_SUPPORT_FILES = [
  'product/normalize-route-condition.ts',
  'product/product-detail-screen.fixtures.ts',
  'product/product-selection.ts',
  'root-layout-nav.tsx',
];

function collectTestUtilsFiles(currentPath: string): string[] {
  return readdirSync(currentPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      return collectTestUtilsFiles(entryPath);
    }

    return /\.test-utils\.(ts|tsx)$/.test(entry.name)
      ? [path.relative(APP_ROOT, entryPath)]
      : [];
  });
}

function collectDisallowedSupportFiles(currentPath: string): string[] {
  return readdirSync(currentPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      return collectDisallowedSupportFiles(entryPath);
    }

    const relativePath = path.relative(APP_ROOT, entryPath);

    return DISALLOWED_SUPPORT_FILES.includes(relativePath) ? [relativePath] : [];
  });
}

describe('app route tree safety', () => {
  it('does not keep test utility modules inside the expo-router app directory', () => {
    expect(collectTestUtilsFiles(APP_ROOT)).toEqual([]);
  });

  it('keeps support modules out of the expo-router app directory', () => {
    expect(collectDisallowedSupportFiles(APP_ROOT)).toEqual([]);
  });
});
