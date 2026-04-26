import { readdirSync } from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../../app');
const SUPPORT_MODULE_FILE_PATTERN =
  /\.(constants|fixtures|helpers|styles|types)\.(ts|tsx)$/;

// These legacy support modules do not follow the suffix pattern above, so keep
// them explicit to prevent regressions back into Expo Router's route tree.
const DISALLOWED_SUPPORT_FILES = [
  'product/normalize-route-condition.ts',
  'product/product-detail-screen.fixtures.ts',
  'product/product-selection.ts',
  'root-layout-nav.tsx',
];

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

describe('app route tree safety', () => {
  it('does not keep test files inside the expo-router app directory', () => {
    expect(
      collectMatchingFiles(APP_ROOT, (fileName) =>
        /\.test\.(ts|tsx)$/.test(fileName)
      )
    ).toEqual([]);
  });

  it('does not keep test utility modules inside the expo-router app directory', () => {
    expect(
      collectMatchingFiles(APP_ROOT, (fileName) =>
        /\.test-utils\.(ts|tsx)$/.test(fileName)
      )
    ).toEqual([]);
  });

  it('does not keep support modules inside the expo-router app directory', () => {
    expect(
      collectMatchingFiles(APP_ROOT, (fileName) =>
        SUPPORT_MODULE_FILE_PATTERN.test(fileName)
      )
    ).toEqual([]);
  });

  it('keeps support modules out of the expo-router app directory', () => {
    expect(collectDisallowedSupportFiles(APP_ROOT)).toEqual([]);
  });
});
