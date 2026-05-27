import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.join(__dirname, 'check-platform-drift.mjs');
const tempDirs = new Set<string>();

function createFixture(files: Record<string, string>) {
  const root = path.join(
    os.tmpdir(),
    `storefront-platform-drift-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
  );
  tempDirs.add(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }

  return root;
}

function runDriftCheck(projectRoot: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--project-root', projectRoot], {
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { force: true, recursive: true });
  }
  tempDirs.clear();
});

describe('check-platform-drift', () => {
  it('passes when every platform branch file is allowlisted', () => {
    const root = createFixture({
      'components/Allowed.tsx':
        "const value = Platform.select({ ios: 'compact', android: 'comfortable' });",
      'config/platform-branch-allowlist.json': JSON.stringify([
        {
          path: 'components/Allowed.tsx',
          justification: 'Reviewed platform-specific spacing.',
        },
      ]),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('fails when a platform branch file is not allowlisted', () => {
    const root = createFixture({
      'components/NewBranch.tsx': "const isIOS = Platform.OS === 'ios';",
      'config/platform-branch-allowlist.json': '[]',
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('New files with Platform.OS / Platform.select');
    expect(result.stderr).toContain('components/NewBranch.tsx');
  });

  it('fails when Platform is destructured and branched without direct Platform.OS syntax', () => {
    const root = createFixture({
      'components/Branch.tsx':
        'import { Platform } from "react-native"; const { OS } = Platform; const isIOS = OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('components/Branch.tsx');
  });

  it('fails when Platform is imported under a short alias and used as alias.OS', () => {
    const root = createFixture({
      'components/AliasDirect.tsx':
        'import { Platform as P } from "react-native"; const isIOS = P.OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('components/AliasDirect.tsx');
  });

  it('fails when Platform is imported under a dollar-prefixed alias and used as alias.OS', () => {
    const root = createFixture({
      'components/DollarAliasDirect.tsx':
        'import { Platform as $P } from "react-native"; const isIOS = $P.OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('components/DollarAliasDirect.tsx');
  });

  it('fails when dollar-prefixed Platform aliases are destructured', () => {
    const root = createFixture({
      'components/DollarAliasDestructure.tsx':
        'import { Platform as $P } from "react-native"; const { OS } = $P; const isIOS = OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('components/DollarAliasDestructure.tsx');
  });

  it('ignores local Platform objects when react-native Platform is not imported', () => {
    const root = createFixture({
      'components/LocalPlatform.tsx':
        'const Platform = { OS: "theme" }; const { OS } = Platform; const value = OS;',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('fails when Platform flows through assigned aliases before member access', () => {
    const root = createFixture({
      'components/AliasAssigned.tsx':
        'import { Platform } from "react-native"; const P = Platform; const NativePlatform = P; const isIOS = NativePlatform.OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('components/AliasAssigned.tsx');
  });

  it('fails when Platform flows through typed aliases before member access', () => {
    const root = createFixture({
      'components/TypedAliasAssigned.tsx':
        'import { Platform } from "react-native"; const P: typeof Platform = Platform; const isIOS = P.OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('components/TypedAliasAssigned.tsx');
  });

  it('ignores alias member branch text inside comments', () => {
    const root = createFixture({
      'components/AliasCommentOnly.tsx':
        'import { Platform as P } from "react-native";\n// TODO remove P.OS check before cleanup\nconst message = "stable";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('ignores alias member branch text inside string literals', () => {
    const root = createFixture({
      'components/AliasStringOnly.tsx':
        'import { Platform as P } from "react-native"; const message = "P.OS is only docs text";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('ignores destructured branch text inside comments', () => {
    const root = createFixture({
      'components/DestructureCommentOnly.tsx':
        'import { Platform } from "react-native";\n// const { OS } = Platform;\nconst message = "no runtime platform branch";',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('ignores shadowed local Platform alias assignments', () => {
    const root = createFixture({
      'components/ShadowedAliasAssignment.tsx':
        'import { Platform } from "react-native";\nfunction getTheme() { const Platform = { OS: "theme" }; const P = Platform; return P.OS; }',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('ignores shadowed local Platform destructures', () => {
    const root = createFixture({
      'components/ShadowedDestructure.tsx':
        'import { Platform } from "react-native";\nfunction getTheme() { const Platform = { OS: "theme" }; const { OS } = Platform; return OS; }',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('ignores shadowed local Platform aliases imported from react-native', () => {
    const root = createFixture({
      'components/ShadowedImportAlias.tsx':
        'import { Platform as P } from "react-native";\nfunction getTheme() { const P = { OS: "theme" }; return P.OS; }',
      'config/platform-branch-allowlist.json': JSON.stringify({ platformBranches: [] }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[platform-drift] OK');
  });

  it('fails on duplicate platform allowlist entries', () => {
    const root = createFixture({
      'app/index.tsx': 'const isIOS = Platform.OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({
        platformBranches: ['app/index.tsx', 'app/index.tsx'],
      }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Duplicate');
  });

  it('fails on duplicate object allowlist entries with the same path', () => {
    const root = createFixture({
      'app/index.tsx': 'const isIOS = Platform.OS === "ios";',
      'config/platform-branch-allowlist.json': JSON.stringify({
        platformBranches: [
          { path: 'app/index.tsx', justification: 'first' },
          { path: 'app/index.tsx', justification: 'duplicate path' },
        ],
      }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Duplicate');
  });

  it('flags the forbidden iOS-only keyboard avoidance pattern', () => {
    const root = createFixture({
      'app/login.tsx':
        "const view = <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} />;",
      'config/platform-branch-allowlist.json': '[]',
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('app/login.tsx');
    expect(result.stderr).toContain('Do not disable Android keyboard avoidance');
  });

  it('flags formatted variants of the forbidden iOS-only keyboard avoidance pattern', () => {
    const root = createFixture({
      'app/login.tsx': `const view = (
        <KeyboardAvoidingView
          behavior = {
            (Platform . OS === "ios")
            ? "padding"
            : undefined
          }
        />
      );`,
      'config/platform-branch-allowlist.json': JSON.stringify({
        platformBranches: ['app/login.tsx'],
      }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('app/login.tsx');
    expect(result.stderr).toContain('Do not disable Android keyboard avoidance');
  });

  it('still requires known forbidden files to be platform-branch allowlisted', () => {
    const root = createFixture({
      'app/login.tsx':
        "const view = <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} />;",
      'config/platform-branch-allowlist.json': JSON.stringify({
        platformBranches: [],
        knownForbiddenPatterns: [
          {
            path: 'app/login.tsx',
            patternId: 'ios-keyboard-avoidance',
            justification: 'Phase 3 migrates this screen to shared keyboard primitives.',
          },
        ],
      }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('New files with Platform.OS / Platform.select');
    expect(result.stderr).toContain('app/login.tsx');
  });

  it('passes when an existing forbidden keyboard pattern is explicitly baselined', () => {
    const root = createFixture({
      'app/login.tsx':
        "const view = <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} />;",
      'config/platform-branch-allowlist.json': JSON.stringify({
        platformBranches: ['app/login.tsx'],
        knownForbiddenPatterns: [
          {
            path: 'app/login.tsx',
            patternId: 'ios-keyboard-avoidance',
            justification: 'Phase 3 migrates this screen to shared keyboard primitives.',
          },
        ],
      }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 known forbidden pattern baseline');
  });

  it('fails when a known forbidden baseline no longer matches source', () => {
    const root = createFixture({
      'app/login.tsx': "const isIOS = Platform.OS === 'ios';",
      'config/platform-branch-allowlist.json': JSON.stringify({
        platformBranches: ['app/login.tsx'],
        knownForbiddenPatterns: [
          {
            path: 'app/login.tsx',
            patternId: 'ios-keyboard-avoidance',
            justification: 'Phase 3 migrates this screen to shared keyboard primitives.',
          },
        ],
      }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Stale known forbidden pattern baselines');
    expect(result.stderr).toContain('app/login.tsx: ios-keyboard-avoidance');
  });

  it('fails when source imports KeyboardAvoidingView directly', () => {
    const root = createFixture({
      'components/Form.tsx':
        "import { KeyboardAvoidingView } from 'react-native';\nexport function Form() { return <KeyboardAvoidingView />; }",
      'config/platform-branch-allowlist.json': JSON.stringify({
        platformBranches: [],
        knownForbiddenPatterns: [],
      }),
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('components/Form.tsx');
    expect(result.stderr).toContain('Do not import KeyboardAvoidingView directly');
  });

  it('reports malformed allowlist JSON', () => {
    const root = createFixture({
      'app/index.tsx': "const isIOS = Platform.OS === 'ios';",
      'config/platform-branch-allowlist.json': '{not json',
    });

    const result = runDriftCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Malformed allowlist file');
  });
});
