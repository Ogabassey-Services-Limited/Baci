const PATCHED_REACT_NATIVE_MARKER =
  '// Baci: compile patched React Native sources';

function ensurePatchedReactNativeBuild(content) {
  if (content.includes(PATCHED_REACT_NATIVE_MARKER)) {
    return content;
  }

  const buildFromSource = `${PATCHED_REACT_NATIVE_MARKER}
def reactNativeSource = new File(
  providers.exec {
    workingDir(rootDir)
    commandLine("node", "--print", "require.resolve('react-native/package.json')")
  }.standardOutput.asText.get().trim()
).getParentFile()

includeBuild(reactNativeSource) {
  dependencySubstitution {
    substitute(module("com.facebook.react:react-android")).using(project(":packages:react-native:ReactAndroid"))
    substitute(module("com.facebook.react:react-native")).using(project(":packages:react-native:ReactAndroid"))
  }
}`;

  return `${content.trimEnd()}\n\n${buildFromSource}\n`;
}

module.exports = ensurePatchedReactNativeBuild;
