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

  it('passes when an existing forbidden keyboard pattern is explicitly baselined', () => {
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

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 known forbidden pattern baseline');
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
