import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface AndroidGoogleServicesFileOptions {
  easBuildProfile?: string;
  projectRoot?: string;
}

const require = createRequire(import.meta.url);
const { resolveAndroidGoogleServicesFile } =
  require('./android-google-services-file') as {
    resolveAndroidGoogleServicesFile: (
      options?: AndroidGoogleServicesFileOptions
    ) => string;
  };

describe('resolveAndroidGoogleServicesFile', () => {
  it('uses the tracked root Firebase config for local development', () => {
    expect(
      resolveAndroidGoogleServicesFile({ projectRoot: '/tmp/project' })
    ).toBe('./google-services.json');
  });

  it('keeps release builds pinned to the real root Firebase config', () => {
    expect(
      resolveAndroidGoogleServicesFile({
        easBuildProfile: 'production',
        projectRoot: '/tmp/project',
      })
    ).toBe('./google-services.json');
    expect(
      resolveAndroidGoogleServicesFile({
        easBuildProfile: 'preview',
        projectRoot: '/tmp/project',
      })
    ).toBe('./google-services.json');
  });
});
