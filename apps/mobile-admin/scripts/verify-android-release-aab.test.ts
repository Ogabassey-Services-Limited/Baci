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
    });

    expect(issues).toEqual([]);
  });

  it('rejects the unoptimized portrait-locked bundle shape reported by Play', () => {
    const issues = findReleaseArtifactIssues({
      archiveEntries: [
        'BUNDLE-METADATA/com.android.tools/d8.json',
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
    });

    expect(issues).toEqual([
      'R8 mapping output is missing or empty',
      'AAB is missing embedded R8 metadata',
      'ML Kit barcode scanner activity still locks an orientation',
    ]);
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
