const rootGoogleServicesFile = './google-services.json';

function resolveAndroidGoogleServicesFile() {
  // Keep the source file outside generated native directories so
  // `expo prebuild --clean` can recreate android/ from config alone.
  return rootGoogleServicesFile;
}

module.exports = { resolveAndroidGoogleServicesFile };
