import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from '@jest/globals';

// Patch-integrity guard for patches/expo-modules-jsi@57.0.3.patch.
//
// Xcode 26.2 (the CI macos-26 image) cannot resolve `abs` in this module's
// Date guard: C++ interop pulls the C stdlib `abs` overloads into scope next
// to Swift's, so `abs(milliseconds)` is rejected as "ambiguous use of 'abs'".
// That archive-failed every storefront iOS release since #3139. The patch
// rewrites the guard to `Double.magnitude` — a property access with no
// overload set, semantically identical here.
//
// Without this test the failure is invisible until the release archive: a
// patch refresh or a dependency re-resolution that drops the patch or
// reintroduces a bare `abs(...)` call would pass every JS-side gate and only
// blow up in Xcode. This regression test reproduces the exact failing
// condition (the ambiguous `abs(...)` form) at the JS layer so it is caught in
// CI instead.

const jsiPackageJsonPath = require.resolve('expo-modules-jsi/package.json');
const jsiRoot = dirname(jsiPackageJsonPath);
const dateGuardPath = join(
  jsiRoot,
  'apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift'
);

describe('bugfix: expo-modules-jsi Xcode 26.2 abs-ambiguity archive failure', () => {
  it('keeps the patch pinned to expo-modules-jsi@57.0.3', () => {
    // 57.0.4 ships this file byte-for-byte identical, so there is no upstream
    // fix to bump to. If the transitive pin ever moves off 57.0.3, re-key the
    // patch to the new version and update this assertion.
    const pkg = JSON.parse(readFileSync(jsiPackageJsonPath, 'utf8')) as {
      version?: string;
    };
    expect(pkg.version).toBe('57.0.3');
  });

  it('applies the Double.magnitude guard and never the ambiguous abs() call', () => {
    expect(existsSync(dateGuardPath)).toBe(true);
    const source = readFileSync(dateGuardPath, 'utf8');

    // The fix must be applied...
    expect(source).toContain('milliseconds.magnitude');
    // ...and the form that fails to compile under Xcode 26.2 must never come
    // back (neither the original inline `abs(...) <= ...` nor an `abs(...)`
    // local — both were ambiguous under C++ interop).
    expect(source).not.toMatch(/\babs\s*\(/);
  });
});
