const { withXcodeProject } = require('@expo/config-plugins');

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const XCODE_PHASE_TYPE = 'PBXShellScriptBuildPhase';
const POSTHOG_XCODE_SCRIPT = 'posthog-xcode.sh';
const POSTHOG_CLI_PATH_EXPORT =
  'export PATH="$PROJECT_ROOT/node_modules/.bin:$PROJECT_ROOT/../../node_modules/.bin:$PATH"';
const LEGACY_APP_ONLY_PATH_EXPORT =
  'export PATH="$PROJECT_ROOT/node_modules/.bin:$PATH"';

function parseShellScript(value) {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function patchPostHogCliPath(script) {
  if (!script.includes(POSTHOG_XCODE_SCRIPT)) {
    return script;
  }

  if (script.includes(POSTHOG_CLI_PATH_EXPORT)) {
    return script;
  }

  if (script.includes(LEGACY_APP_ONLY_PATH_EXPORT)) {
    return script.replace(LEGACY_APP_ONLY_PATH_EXPORT, POSTHOG_CLI_PATH_EXPORT);
  }

  const projectRootMatch = script.match(/^export PROJECT_ROOT=.*$/m);
  if (!projectRootMatch || projectRootMatch.index === undefined) {
    return `${POSTHOG_CLI_PATH_EXPORT}\n${script}`;
  }

  const insertAt = projectRootMatch.index + projectRootMatch[0].length;
  return `${script.slice(0, insertAt)}\n${POSTHOG_CLI_PATH_EXPORT}${script.slice(insertAt)}`;
}

const withPostHogXcodeCliPath = (config) =>
  withXcodeProject(config, (config) => {
    const bundlePhase = config.modResults.pbxItemByComment(
      BUNDLE_PHASE_NAME,
      XCODE_PHASE_TYPE
    );

    const shellScript = parseShellScript(bundlePhase?.shellScript);
    if (!shellScript) {
      return config;
    }

    const patchedScript = patchPostHogCliPath(shellScript);
    if (patchedScript !== shellScript) {
      bundlePhase.shellScript = JSON.stringify(patchedScript);
    }

    return config;
  });

module.exports = withPostHogXcodeCliPath;
