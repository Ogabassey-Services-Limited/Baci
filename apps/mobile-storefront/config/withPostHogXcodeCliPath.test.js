let mockProject;

jest.mock('@expo/config-plugins', () => ({
  withXcodeProject: (config, action) =>
    action({
      ...config,
      modResults: mockProject,
    }),
}));

const withPostHogXcodeCliPath = require('./withPostHogXcodeCliPath');

const PHASE_NAME = 'Bundle React Native code and images';
const PHASE_TYPE = 'PBXShellScriptBuildPhase';
const EXPECTED_PATH_EXPORT =
  'export PATH="$PROJECT_ROOT/node_modules/.bin:$PROJECT_ROOT/../../node_modules/.bin:$PATH"';

function runPluginWithShellScript(shellScript) {
  const phase = {
    shellScript: JSON.stringify(shellScript),
  };
  mockProject = {
    pbxItemByComment: jest.fn().mockReturnValue(phase),
  };

  withPostHogXcodeCliPath({ name: 'Ogabassey', slug: 'ogabassey' });

  return {
    phase,
    script: JSON.parse(phase.shellScript),
  };
}

describe('withPostHogXcodeCliPath', () => {
  afterEach(() => {
    mockProject = undefined;
  });

  it('prepends app and workspace node bins before the PostHog Xcode wrapper runs', () => {
    const { script } =
      runPluginWithShellScript(`export PROJECT_ROOT="$PROJECT_DIR"/..

/bin/sh "$PROJECT_ROOT/node_modules/posthog-react-native/tooling/posthog-xcode.sh"
`);

    expect(script).toContain(`export PROJECT_ROOT="$PROJECT_DIR"/..
${EXPECTED_PATH_EXPORT}
`);
    expect(script).toContain('posthog-xcode.sh');
  });

  it('upgrades the older app-only PATH patch without duplicating it', () => {
    const { script } =
      runPluginWithShellScript(`export PROJECT_ROOT="$PROJECT_DIR"/..
export PATH="$PROJECT_ROOT/node_modules/.bin:$PATH"

/bin/sh "$PROJECT_ROOT/node_modules/posthog-react-native/tooling/posthog-xcode.sh"
`);

    expect(script).toContain(EXPECTED_PATH_EXPORT);
    expect(script.match(/PROJECT_ROOT\/node_modules\/\.bin/g)).toHaveLength(1);
  });

  it('leaves unrelated Xcode phases unchanged', () => {
    const { script } =
      runPluginWithShellScript(`export PROJECT_ROOT="$PROJECT_DIR"/..
/bin/sh "$PROJECT_ROOT/node_modules/react-native/scripts/react-native-xcode.sh"
`);

    expect(script).not.toContain(EXPECTED_PATH_EXPORT);
  });

  it('looks up the generated bundle phase by Xcode comment and type', () => {
    runPluginWithShellScript(`export PROJECT_ROOT="$PROJECT_DIR"/..
/bin/sh "$PROJECT_ROOT/node_modules/posthog-react-native/tooling/posthog-xcode.sh"
`);

    expect(mockProject.pbxItemByComment).toHaveBeenCalledWith(
      PHASE_NAME,
      PHASE_TYPE
    );
  });
});
