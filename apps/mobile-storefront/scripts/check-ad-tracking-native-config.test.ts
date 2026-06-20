import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT_PATH = path.join(__dirname, 'check-ad-tracking-native-config.mjs');
const PROJECT_ROOT = path.resolve(__dirname, '..');

function runNativeAdConfigCheck(projectRoot = PROJECT_ROOT) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--project-root', projectRoot], {
    encoding: 'utf8',
  });
}

describe('check-ad-tracking-native-config', () => {
  it('keeps the committed iOS ad-tracking plist in sync with app config', () => {
    const result = runNativeAdConfigCheck();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[ad-tracking-native-config] OK');
  });
});
