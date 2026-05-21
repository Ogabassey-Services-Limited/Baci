import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findForbiddenPatternViolations,
  findNonAllowlistedFiles,
  findPlatformBranchFiles,
  findPlatformImportFiles,
  findStaleAllowlistEntries,
  isCanonicalAllowlist,
} from './check-platform-drift.mjs';

const tempDirs = new Set<string>();

function createFixture(files: Record<string, string>) {
  const root = path.join(
    os.tmpdir(),
    `platform-drift-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  tempDirs.add(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }

  return root;
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { force: true, recursive: true });
  }
  tempDirs.clear();
});

describe('check-platform-drift', () => {
  it('finds platform-specific files and ignores tests', () => {
    const root = createFixture({
      'app/example.tsx': 'const isIOS = Platform.OS === "ios";',
      'components/example.test.tsx': 'const isIOS = Platform.OS === "ios";',
    });

    expect(findPlatformBranchFiles(root)).toEqual(['app/example.tsx']);
  });

  it('detects any Platform property usage, not only OS/select', () => {
    const root = createFixture({
      'hooks/example.ts': 'const version = Platform.Version;',
    });

    expect(findPlatformBranchFiles(root)).toEqual(['hooks/example.ts']);
  });

  it('returns empty array when no Platform usage exists', () => {
    const root = createFixture({
      'hooks/no-platform.ts': 'const label = "no platform branch";',
    });

    expect(findPlatformBranchFiles(root)).toEqual([]);
  });

  it('detects Platform imports from react-native', () => {
    const root = createFixture({
      'lib/example.ts':
        'import { Platform } from "react-native"; const value = "ok";',
      'lib/example-alias.ts':
        'import { Platform as NativePlatform } from "react-native"; const value = "ok";',
    });

    expect(findPlatformImportFiles(root)).toEqual([
      'lib/example-alias.ts',
      'lib/example.ts',
    ]);
  });

  it('returns empty array when no Platform imports exist', () => {
    const root = createFixture({
      'lib/no-platform-import.ts': 'const stable = "no import";',
    });

    expect(findPlatformImportFiles(root)).toEqual([]);
  });

  it('ignores Platform imports from non-react-native packages', () => {
    const root = createFixture({
      'lib/other-package.ts':
        'import { Platform } from "some-other-package"; const stable = true;',
    });

    expect(findPlatformImportFiles(root)).toEqual([]);
  });

  it('detects files outside the allowlist', () => {
    expect(
      findNonAllowlistedFiles(
        ['app/known.tsx', 'components/new.tsx'],
        ['app/known.tsx']
      )
    ).toEqual(['components/new.tsx']);
  });

  it('detects stale entries in the allowlist', () => {
    expect(
      findStaleAllowlistEntries(
        ['app/known.tsx', 'components/stale.tsx'],
        ['app/known.tsx']
      )
    ).toEqual(['components/stale.tsx']);
  });

  it('returns true for canonical one-file allowlist', () => {
    expect(isCanonicalAllowlist(['config/runtime-platform.ts'])).toBe(true);
  });

  it('returns false for non-canonical allowlist', () => {
    expect(
      isCanonicalAllowlist(['config/runtime-platform.ts', 'app/legacy.tsx'])
    ).toBe(false);
  });

  it('returns false for empty allowlists', () => {
    expect(isCanonicalAllowlist([])).toBe(false);
  });

  it('returns false for invalid allowlist inputs', () => {
    expect(isCanonicalAllowlist(undefined as unknown as string[])).toBe(false);
    expect(isCanonicalAllowlist(null as unknown as string[])).toBe(false);
    expect(isCanonicalAllowlist(['app/not-runtime-platform.ts'])).toBe(false);
  });

  it('flags the forbidden android keyboard pattern', () => {
    const root = createFixture({
      'components/example.tsx':
        "const view = <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} />;",
    });

    const found = findPlatformBranchFiles(root);
    const violations = findForbiddenPatternViolations(root, found);

    expect(violations).toEqual([
      expect.objectContaining({ file: 'components/example.tsx' }),
    ]);
  });
});
