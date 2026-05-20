import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '../..');

describe('Android emulator launcher', () => {
  it('is the documented mobile-admin Android QA entrypoint', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(appRoot, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    const agents = readFileSync(path.join(appRoot, 'AGENTS.md'), 'utf8');
    const rootAgents = readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
    const claudeInstructions = readFileSync(
      path.join(repoRoot, 'CLAUDE.md'),
      'utf8'
    );
    const geminiInstructions = readFileSync(
      path.join(repoRoot, 'GEMINI.md'),
      'utf8'
    );
    const copilotInstructions = readFileSync(
      path.join(repoRoot, '.github/copilot-instructions.md'),
      'utf8'
    );
    const rulerAgents = readFileSync(
      path.join(repoRoot, '.ruler/AGENTS.md'),
      'utf8'
    );
    const rulerTesting = readFileSync(
      path.join(repoRoot, '.ruler/07-testing.md'),
      'utf8'
    );
    const readme = readFileSync(path.join(appRoot, 'README.md'), 'utf8');
    const androidQaPlan = readFileSync(
      path.join(
        repoRoot,
        'docs/superpowers/plans/2026-05-10-branch-system-android-e2e-qa.md'
      ),
      'utf8'
    );
    const launcher = readFileSync(
      path.join(appRoot, 'scripts/launch-android-emulator.sh'),
      'utf8'
    );

    expect(packageJson.scripts?.['android:emulator']).toBe(
      'bash ./scripts/launch-android-emulator.sh'
    );
    expect(agents).toContain('pnpm --filter baci-mobile-admin android:emulator');
    expect(rootAgents).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(claudeInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(geminiInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(copilotInstructions).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(rulerAgents).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(rulerTesting).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(readme).toContain('pnpm --filter baci-mobile-admin android:emulator');
    expect(androidQaPlan).toContain(
      'pnpm --filter baci-mobile-admin android:emulator'
    );
    expect(androidQaPlan).not.toContain('"$EMULATOR" -avd');
    expect(launcher).toContain('BACI_ANDROID_GPU_MODE:-auto');
    expect(launcher).toContain('BACI_ANDROID_MIN_EMULATOR_BUILD:-15261927');
    expect(launcher).toContain('Refusing -gpu swiftshader_indirect');
    expect(launcher).toContain('Android Emulator is too old');
    expect(launcher).toContain('shell echo ok');
    expect(launcher).toContain('run_with_timeout');
    expect(launcher).toContain('BACI_ANDROID_ADB_STABILITY_PROBES:-3');
    expect(launcher).toContain('confirm_adb_shell_stable');
    expect(launcher).toContain('cleanup_files=()');
    expect(launcher).toContain('trap cleanup EXIT');
    expect(launcher).toContain('python3 is required');
    expect(launcher).toContain('start_new_session=True');
  });
});
