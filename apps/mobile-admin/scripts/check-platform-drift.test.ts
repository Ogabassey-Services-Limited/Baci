import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findForbiddenPatternViolations,
  findNonAllowlistedFiles,
  findPlatformBranchFiles,
  findStaleAllowlistEntries,
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
