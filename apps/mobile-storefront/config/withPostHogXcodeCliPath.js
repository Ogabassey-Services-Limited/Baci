const { withXcodeProject } = require('@expo/config-plugins');

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const DSYM_UPLOAD_PHASE_NAME = 'Upload PostHog Debug Symbols';
const XCODE_PHASE_TYPE = 'PBXShellScriptBuildPhase';
const POSTHOG_XCODE_SCRIPT = 'posthog-xcode.sh';
const POSTHOG_DSYM_UPLOAD_SCRIPT = 'upload-symbols.sh';
const PROJECT_ROOT_EXPORT = 'export PROJECT_ROOT="$PROJECT_DIR"/..';
const POSTHOG_CLI_PATH_EXPORT =
  'export PATH="$PROJECT_ROOT/node_modules/.bin:$PROJECT_ROOT/../../node_modules/.bin:$PATH"';
const LEGACY_APP_ONLY_PATH_EXPORT =
  'export PATH="$PROJECT_ROOT/node_modules/.bin:$PATH"';
const POSTHOG_DSYM_UPLOAD_WARNING =
  'PostHog dSYM upload failed; continuing archive. Native crash symbolication may be incomplete.';
const POSTHOG_DSYM_INPUT_PATH = `\${DWARF_DSYM_FOLDER_PATH}/\${DWARF_DSYM_FILE_NAME}/Contents/Resources/DWARF/\${PRODUCT_NAME}`;
const QUOTED_POSTHOG_DSYM_INPUT_PATH = `"${POSTHOG_DSYM_INPUT_PATH}"`;

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

function ensureProjectRootExport(script) {
  return /^export PROJECT_ROOT=.*$/m.test(script)
    ? script
    : `${PROJECT_ROOT_EXPORT}\n${script}`;
}

function patchPostHogCliPath(script, marker = POSTHOG_XCODE_SCRIPT) {
  if (!script.includes(marker)) {
    return script;
  }

  if (script.includes(POSTHOG_CLI_PATH_EXPORT)) {
    return ensureProjectRootExport(script);
  }

  if (script.includes(LEGACY_APP_ONLY_PATH_EXPORT)) {
    return ensureProjectRootExport(
      script.replace(LEGACY_APP_ONLY_PATH_EXPORT, POSTHOG_CLI_PATH_EXPORT)
    );
  }

  const projectRootMatch = script.match(/^export PROJECT_ROOT=.*$/m);
  if (!projectRootMatch || projectRootMatch.index === undefined) {
    return `${PROJECT_ROOT_EXPORT}\n${POSTHOG_CLI_PATH_EXPORT}\n${script}`;
  }

  const insertAt = projectRootMatch.index + projectRootMatch[0].length;
  return `${script.slice(0, insertAt)}\n${POSTHOG_CLI_PATH_EXPORT}${script.slice(insertAt)}`;
}

function patchShellPhaseCliPath(phase, marker) {
  const shellScript = parseShellScript(phase?.shellScript);
  if (!shellScript) {
    return;
  }

  const patchedScript = patchPostHogCliPath(shellScript, marker);
  if (patchedScript !== shellScript) {
    phase.shellScript = JSON.stringify(patchedScript);
  }
}

function patchPostHogDsymUploadBestEffort(script) {
  if (!script.includes(POSTHOG_DSYM_UPLOAD_SCRIPT)) {
    return script;
  }

  const wrapCommand = (line, command) => {
    if (line.trim() !== command) {
      return line;
    }

    const indent = line.match(/^\s*/)?.[0] ?? '';
    return `${indent}if ! ${command}; then
${indent}  echo "warning: ${POSTHOG_DSYM_UPLOAD_WARNING}"
${indent}fi`;
  };

  return ['/bin/sh "$PODS_SCRIPT"', '/bin/sh "$SPM_SCRIPT"'].reduce(
    (patchedScript, command) => {
      return patchedScript
        .split('\n')
        .map((line) => wrapCommand(line, command))
        .join('\n');
    },
    script
  );
}

function patchDsymUploadPhaseScript(phase) {
  const shellScript = parseShellScript(phase?.shellScript);
  if (!shellScript) {
    return;
  }

  const withCliPath = patchPostHogCliPath(
    shellScript,
    POSTHOG_DSYM_UPLOAD_SCRIPT
  );
  const patchedScript = patchPostHogDsymUploadBestEffort(withCliPath);
  if (patchedScript !== shellScript) {
    phase.shellScript = JSON.stringify(patchedScript);
  }
}

function patchDsymUploadInputPath(phase) {
  if (!phase) {
    return;
  }

  const inputPaths = Array.isArray(phase.inputPaths) ? phase.inputPaths : [];
  if (
    inputPaths.includes(POSTHOG_DSYM_INPUT_PATH) ||
    inputPaths.includes(QUOTED_POSTHOG_DSYM_INPUT_PATH)
  ) {
    return;
  }

  phase.inputPaths = [...inputPaths, QUOTED_POSTHOG_DSYM_INPUT_PATH];
}

const withPostHogXcodeCliPath = (config) =>
  withXcodeProject(config, (config) => {
    const bundlePhase = config.modResults.pbxItemByComment(
      BUNDLE_PHASE_NAME,
      XCODE_PHASE_TYPE
    );
    const dsymUploadPhase = config.modResults.pbxItemByComment(
      DSYM_UPLOAD_PHASE_NAME,
      XCODE_PHASE_TYPE
    );

    patchShellPhaseCliPath(bundlePhase, POSTHOG_XCODE_SCRIPT);
    patchDsymUploadPhaseScript(dsymUploadPhase);
    patchDsymUploadInputPath(dsymUploadPhase);

    return config;
  });

module.exports = withPostHogXcodeCliPath;
