import { readdirSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../../app');
const SUPPORT_MODULE_FILE_PATTERN =
  /(^|\.)(constants|fixtures|helpers|styles|types)\.(ts|tsx)$/;

// These legacy support modules do not follow the suffix pattern above, so keep
// them explicit to prevent regressions back into Expo Router's route tree.
const DISALLOWED_SUPPORT_FILES = [
  'product/normalize-route-condition.ts',
  'product/product-selection.ts',
  'root-layout-nav.tsx',
];
const ROUTE_TREE_REMEDIATION =
  'Remove test/support files from app/ or move them to __tests__, components, lib, or a utilities folder.';

function collectMatchingFiles(
  currentPath: string,
  matcher: (fileName: string) => boolean
): string[] {
  return readdirSync(currentPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      return collectMatchingFiles(entryPath, matcher);
    }

    return matcher(entry.name) ? [path.relative(APP_ROOT, entryPath)] : [];
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

function expectNoAppTreeMatches(matches: string[], policy: string) {
  if (matches.length > 0) {
    throw new Error(
      `Found banned files under app/: ${matches.join(', ')}. Policy: ${policy}. ${ROUTE_TREE_REMEDIATION}`
    );
  }

  expect(matches).toEqual([]);
}

describe('app route tree safety', () => {
  it('does not keep test files inside the expo-router app directory', () => {
    const matches = collectMatchingFiles(APP_ROOT, (fileName) =>
      /\.test\.(ts|tsx)$/.test(fileName)
    );

    expectNoAppTreeMatches(matches, 'Route tests must not live in app/.');
  });

  it('does not keep test utility modules inside the expo-router app directory', () => {
    const matches = collectMatchingFiles(APP_ROOT, (fileName) =>
      /\.test-utils\.(ts|tsx)$/.test(fileName)
    );

    expectNoAppTreeMatches(matches, 'Test utilities must not live in app/.');
  });

  it('does not keep support modules inside the expo-router app directory', () => {
    const matches = collectMatchingFiles(APP_ROOT, (fileName) =>
      SUPPORT_MODULE_FILE_PATTERN.test(fileName)
    );

    expectNoAppTreeMatches(matches, 'Support modules must not live in app/.');
  });

  it('keeps support modules out of the expo-router app directory', () => {
    expect(collectDisallowedSupportFiles(APP_ROOT)).toEqual([]);
  });
});
