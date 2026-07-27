import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findReleaseArtifactIssues } from './verify-android-release-aab.mjs';

describe('findReleaseArtifactIssues', () => {
  it('accepts an optimized bundle without an orientation restriction', () => {
    const issues = findReleaseArtifactIssues({
      archiveEntries: [
        'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map',
        'BUNDLE-METADATA/com.android.tools/r8.json',
        'base/manifest/AndroidManifest.xml',
      ],
      manifestXml: `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application>
            <activity android:name="com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity" />
          </application>
        </manifest>
      `,
      mappingSize: 42,
      r8Metadata: JSON.stringify({
        options: {
          isOptimizationsEnabled: true,
          isRepackageClassesEnabled: true,
        },
        resourceOptimization: { isOptimizedShrinkingEnabled: true },
      }),
    });

    expect(issues).toEqual([]);
  });

  it('rejects the unoptimized portrait-locked bundle shape reported by Play', () => {
    const issues = findReleaseArtifactIssues({
      archiveEntries: [
        'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map',
        'BUNDLE-METADATA/com.android.tools/r8.json',
        'base/manifest/AndroidManifest.xml',
      ],
      manifestXml: `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application>
            <activity
              android:name="com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity"
              android:screenOrientation="1" />
          </application>
        </manifest>
      `,
      mappingSize: 0,
      r8Metadata: JSON.stringify({
        options: {
          isOptimizationsEnabled: false,
          isRepackageClassesEnabled: false,
        },
        resourceOptimization: { isOptimizedShrinkingEnabled: false },
      }),
    });

    expect(issues).toEqual([
      'R8 mapping output is missing or empty',
      'R8 code optimization is disabled',
      'R8 class repackaging is disabled',
      'R8 optimized resource shrinking is disabled',
      'ML Kit barcode scanner activity still locks an orientation',
    ]);
  });

  it('rejects a bundle that still requests the unused Advertising ID permission', () => {
    const issues = findReleaseArtifactIssues({
      archiveEntries: [
        'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map',
        'BUNDLE-METADATA/com.android.tools/r8.json',
      ],
      manifestXml: `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
          <application />
        </manifest>
      `,
      mappingSize: 42,
      r8Metadata: JSON.stringify({
        options: {
          isOptimizationsEnabled: true,
          isRepackageClassesEnabled: true,
        },
        resourceOptimization: { isOptimizedShrinkingEnabled: true },
      }),
    });

    expect(issues).toEqual([
      'AAB still requests the unused Advertising ID permission',
    ]);
  });

  it('reports missing R8 metadata without inferring disabled options', () => {
    const issues = findReleaseArtifactIssues({
      archiveEntries: [
        'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map',
        'base/manifest/AndroidManifest.xml',
      ],
      manifestXml: '<manifest><application /></manifest>',
      mappingSize: 42,
      r8Metadata: undefined,
    });

    expect(issues).toEqual(['AAB is missing embedded R8 metadata']);
  });

  it('reports invalid R8 metadata without inferring disabled options', () => {
    const issues = findReleaseArtifactIssues({
      archiveEntries: [
        'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map',
        'BUNDLE-METADATA/com.android.tools/r8.json',
      ],
      manifestXml: '<manifest><application /></manifest>',
      mappingSize: 42,
      r8Metadata: '{invalid',
    });

    expect(issues).toEqual(['AAB contains invalid R8 metadata']);
  });

  it('rejects valid JSON that is not structured R8 metadata', () => {
    const issues = findReleaseArtifactIssues({
      archiveEntries: [
        'BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map',
        'BUNDLE-METADATA/com.android.tools/r8.json',
      ],
      manifestXml: '<manifest><application /></manifest>',
      mappingSize: 42,
      r8Metadata: 'null',
    });

    expect(issues).toEqual(['AAB contains invalid R8 metadata']);
  });

  it('fails closed when required artifact paths are missing', () => {
    const scriptPath = resolve(
      process.cwd(),
      'scripts/verify-android-release-aab.mjs'
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Usage: verify-android-release-aab.mjs --aab'
    );
  });
});
