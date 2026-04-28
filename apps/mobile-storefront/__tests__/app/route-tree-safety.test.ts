import { existsSync, readdirSync } from 'node:fs';
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

    return DISALLOWED_SUPPORT_FILES.includes(relativePath)
      ? [relativePath]
      : [];
  });
}

const TAB_ROUTE_DIR = path.resolve(APP_ROOT, '(tabs)');

// Expo Router auto-registers any non-underscored module file as a route.
// Helper modules that live next to a tab screen (e.g. `wallet.styles.ts`)
// therefore leak as `wallet.styles` tabs in the bottom bar.
//
// Match files of the form `<segment>.<segment>.<ext>` where:
//   - both segments are lowercase alphanumeric or hyphens,
//   - the middle segment is NOT `test` or `test-utils` (those are real test files),
//   - extension is ts/tsx/js/jsx.
function collectLeakedTabHelpers(): string[] {
  return readdirSync(TAB_ROUTE_DIR).filter((fileName) =>
    /^[a-z0-9-]+\.(?!test\.|test-utils\.)[a-z0-9-]+\.(ts|tsx|js|jsx)$/.test(
      fileName
    )
  );
}

describe('app route tree safety', () => {
  it('does not keep test utility modules inside the expo-router app directory', () => {
    expect(collectTestUtilsFiles(APP_ROOT)).toEqual([]);
  });

  it('keeps support modules out of the expo-router app directory', () => {
    expect(collectDisallowedSupportFiles(APP_ROOT)).toEqual([]);
  });

  it('keeps non-route helper modules out of the (tabs) directory', () => {
    // Fail loudly if the (tabs) directory is missing or renamed — silently
    // returning [] would let a structural regression slip through.
    expect(existsSync(TAB_ROUTE_DIR)).toBe(true);
    expect(collectLeakedTabHelpers()).toEqual([]);
  });
});
