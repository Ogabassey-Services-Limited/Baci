const { existsSync } = require('node:fs');
const path = require('node:path');

const rootGoogleServicesFile = './google-services.json';
// Non-release builds fall back to this source-controlled debug config after
// checking for a local root google-services.json. The Gradle config test
// validates the file remains present for local Android builds.
const debugGoogleServicesFile = './android/app/src/debug/google-services.json';
const releaseBuildProfiles = new Set(['preview', 'production']);

function resolveAndroidGoogleServicesFile({
  easBuildProfile = process.env.EAS_BUILD_PROFILE,
  projectRoot = path.resolve(__dirname, '..'),
} = {}) {
  if (releaseBuildProfiles.has(easBuildProfile ?? '')) {
    return rootGoogleServicesFile;
  }

  if (existsSync(path.join(projectRoot, 'google-services.json'))) {
    return rootGoogleServicesFile;
  }

  return debugGoogleServicesFile;
}

module.exports = { resolveAndroidGoogleServicesFile };
