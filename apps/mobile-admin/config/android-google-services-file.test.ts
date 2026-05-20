import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

interface AndroidGoogleServicesFileOptions {
  easBuildProfile?: string;
  projectRoot?: string;
}

const require = createRequire(import.meta.url);
const { resolveAndroidGoogleServicesFile } = require(
  './android-google-services-file'
) as {
  resolveAndroidGoogleServicesFile: (
    options?: AndroidGoogleServicesFileOptions
  ) => string;
};

describe('resolveAndroidGoogleServicesFile', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('uses the tracked debug Firebase config for local development when the root config is absent', () => {
    const projectRoot = mkdtempSync(
      path.join(os.tmpdir(), 'baci-admin-google-services-')
    );
    tempDirs.push(projectRoot);

    expect(resolveAndroidGoogleServicesFile({ projectRoot })).toBe(
      './android/app/src/debug/google-services.json'
    );
  });

  it('uses the root Firebase config when it exists locally', () => {
    const projectRoot = mkdtempSync(
      path.join(os.tmpdir(), 'baci-admin-google-services-')
    );
    tempDirs.push(projectRoot);
    writeFileSync(path.join(projectRoot, 'google-services.json'), '{}');

    expect(resolveAndroidGoogleServicesFile({ projectRoot })).toBe(
      './google-services.json'
    );
  });

  it('keeps release builds pinned to the real root Firebase config', () => {
    const projectRoot = mkdtempSync(
      path.join(os.tmpdir(), 'baci-admin-google-services-')
    );
    tempDirs.push(projectRoot);
    mkdirSync(path.join(projectRoot, 'android/app/src/debug'), {
      recursive: true,
    });

    expect(
      resolveAndroidGoogleServicesFile({
        easBuildProfile: 'production',
        projectRoot,
      })
    ).toBe('./google-services.json');
    expect(
      resolveAndroidGoogleServicesFile({ easBuildProfile: 'preview', projectRoot })
    ).toBe('./google-services.json');
  });
});
