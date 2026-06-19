let mockProject;

jest.mock('@expo/config-plugins', () => ({
  withXcodeProject: (config, action) =>
    action({
      ...config,
      modResults: mockProject,
    }),
}));

const withPostHogXcodeCliPath = require('./withPostHogXcodeCliPath');

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const DSYM_UPLOAD_PHASE_NAME = 'Upload PostHog Debug Symbols';
const PHASE_TYPE = 'PBXShellScriptBuildPhase';
const EXPECTED_PATH_EXPORT =
  'export PATH="$PROJECT_ROOT/node_modules/.bin:$PROJECT_ROOT/../../node_modules/.bin:$PATH"';
const EXPECTED_DSYM_INPUT_PATH = `"\${DWARF_DSYM_FOLDER_PATH}/\${DWARF_DSYM_FILE_NAME}/Contents/Resources/DWARF/\${PRODUCT_NAME}"`;

function runPluginWithPhases({
  bundleShellScript = '',
  dsymShellScript = '',
  dsymInputPaths = [],
} = {}) {
  const bundlePhase = {
    shellScript: JSON.stringify(bundleShellScript),
  };
  const dsymUploadPhase = {
    inputPaths: dsymInputPaths,
    shellScript: JSON.stringify(dsymShellScript),
  };
  mockProject = {
    pbxItemByComment: jest.fn((phaseName) => {
      if (phaseName === BUNDLE_PHASE_NAME) {
        return bundlePhase;
      }
      if (phaseName === DSYM_UPLOAD_PHASE_NAME) {
        return dsymUploadPhase;
      }
      return undefined;
    }),
  };

  withPostHogXcodeCliPath({ name: 'Ogabassey', slug: 'ogabassey' });

  return {
    bundlePhase,
    bundleScript: JSON.parse(bundlePhase.shellScript),
    dsymUploadPhase,
    dsymScript: JSON.parse(dsymUploadPhase.shellScript),
  };
}

describe('withPostHogXcodeCliPath', () => {
  afterEach(() => {
    mockProject = undefined;
  });

  it('prepends app and workspace node bins before the PostHog Xcode wrapper runs', () => {
    const { bundleScript } = runPluginWithPhases({
      bundleShellScript: `export PROJECT_ROOT="$PROJECT_DIR"/..

/bin/sh "$PROJECT_ROOT/node_modules/posthog-react-native/tooling/posthog-xcode.sh"
`,
    });

    expect(bundleScript).toContain(`export PROJECT_ROOT="$PROJECT_DIR"/..
${EXPECTED_PATH_EXPORT}
`);
    expect(bundleScript).toContain('posthog-xcode.sh');
  });

  it('upgrades the older app-only PATH patch without duplicating it', () => {
    const { bundleScript } = runPluginWithPhases({
      bundleShellScript: `export PROJECT_ROOT="$PROJECT_DIR"/..
export PATH="$PROJECT_ROOT/node_modules/.bin:$PATH"

/bin/sh "$PROJECT_ROOT/node_modules/posthog-react-native/tooling/posthog-xcode.sh"
`,
    });

    expect(bundleScript).toContain(EXPECTED_PATH_EXPORT);
    expect(
      bundleScript.match(/PROJECT_ROOT\/node_modules\/\.bin/g)
    ).toHaveLength(1);
  });

  it('leaves unrelated Xcode phases unchanged', () => {
    const { bundleScript } = runPluginWithPhases({
      bundleShellScript: `export PROJECT_ROOT="$PROJECT_DIR"/..
/bin/sh "$PROJECT_ROOT/node_modules/react-native/scripts/react-native-xcode.sh"
`,
    });

    expect(bundleScript).not.toContain(EXPECTED_PATH_EXPORT);
  });

  it('looks up the generated bundle phase by Xcode comment and type', () => {
    runPluginWithPhases({
      bundleShellScript: `export PROJECT_ROOT="$PROJECT_DIR"/..
/bin/sh "$PROJECT_ROOT/node_modules/posthog-react-native/tooling/posthog-xcode.sh"
`,
    });

    expect(mockProject.pbxItemByComment).toHaveBeenCalledWith(
      BUNDLE_PHASE_NAME,
      PHASE_TYPE
    );
  });

  it('patches the generated PostHog dSYM upload phase for pnpm CLI lookup and dSYM readiness', () => {
    const { dsymScript, dsymUploadPhase } = runPluginWithPhases({
      dsymShellScript: `# Upload iOS dSYMs to PostHog so native crashes can be symbolicated.
PODS_SCRIPT="\${PODS_ROOT}/PostHog/build-tools/upload-symbols.sh"
/bin/sh "$PODS_SCRIPT"
`,
    });

    expect(dsymScript).toContain('export PROJECT_ROOT="$PROJECT_DIR"/..');
    expect(dsymScript).toContain(EXPECTED_PATH_EXPORT);
    expect(dsymScript).toContain('if ! /bin/sh "$PODS_SCRIPT"; then');
    expect(dsymScript).toContain(
      'warning: PostHog dSYM upload failed; continuing archive.'
    );
    expect(dsymUploadPhase.inputPaths).toContain(EXPECTED_DSYM_INPUT_PATH);
  });

  it('does not duplicate the generated dSYM upload PATH or input path', () => {
    const { dsymScript, dsymUploadPhase } = runPluginWithPhases({
      dsymInputPaths: [EXPECTED_DSYM_INPUT_PATH],
      dsymShellScript: `# Upload iOS dSYMs to PostHog so native crashes can be symbolicated.
${EXPECTED_PATH_EXPORT}
PODS_SCRIPT="\${PODS_ROOT}/PostHog/build-tools/upload-symbols.sh"
/bin/sh "$PODS_SCRIPT"
`,
    });

    expect(dsymScript.match(/PROJECT_ROOT\/node_modules\/\.bin/g)).toHaveLength(
      1
    );
    expect(dsymScript).toContain('export PROJECT_ROOT="$PROJECT_DIR"/..');
    expect(dsymUploadPhase.inputPaths).toEqual([EXPECTED_DSYM_INPUT_PATH]);
  });

  it('does not duplicate the dSYM upload failure warning wrapper', () => {
    const { dsymScript } = runPluginWithPhases({
      dsymShellScript: `# Upload iOS dSYMs to PostHog so native crashes can be symbolicated.
export PROJECT_ROOT="$PROJECT_DIR"/..
${EXPECTED_PATH_EXPORT}
PODS_SCRIPT="\${PODS_ROOT}/PostHog/build-tools/upload-symbols.sh"
if ! /bin/sh "$PODS_SCRIPT"; then
  echo "warning: PostHog dSYM upload failed; continuing archive. Native crash symbolication may be incomplete."
fi
`,
    });

    expect(
      dsymScript.match(/PostHog dSYM upload failed/g)
    ).toHaveLength(1);
  });

  it('looks up the generated dSYM upload phase by Xcode comment and type', () => {
    runPluginWithPhases();

    expect(mockProject.pbxItemByComment).toHaveBeenCalledWith(
      DSYM_UPLOAD_PHASE_NAME,
      PHASE_TYPE
    );
  });
});
