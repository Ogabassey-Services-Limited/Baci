import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT_PATH = path.join(__dirname, 'check-ad-tracking-native-config.mjs');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_CONFIG_PATH = path.join(PROJECT_ROOT, 'app.config.ts');
const INFO_PLIST_PATH = path.join(
  PROJECT_ROOT,
  'ios',
  'Ogabassey',
  'Info.plist'
);
const XCODE_PROJECT_PATH = path.join(
  PROJECT_ROOT,
  'ios',
  'Ogabassey.xcodeproj',
  'project.pbxproj'
);

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

  it('accepts double-quoted app config ad declarations on the same line', () => {
    const tempRoot = mkdtempSync(
      path.join(os.tmpdir(), 'baci-ad-tracking-config-')
    );
    try {
      mkdirSync(path.join(tempRoot, 'ios', 'Ogabassey.xcodeproj'), {
        recursive: true,
      });
      mkdirSync(path.join(tempRoot, 'ios', 'Ogabassey'), { recursive: true });
      copyFileSync(INFO_PLIST_PATH, path.join(tempRoot, 'ios', 'Ogabassey', 'Info.plist'));
      copyFileSync(
        XCODE_PROJECT_PATH,
        path.join(tempRoot, 'ios', 'Ogabassey.xcodeproj', 'project.pbxproj')
      );

      const appConfigSource = readFileSync(APP_CONFIG_PATH, 'utf8')
        .replace(
          /NSUserTrackingUsageDescription:\s*\n\s*'([^']+)'/,
          'NSUserTrackingUsageDescription: "$1"'
        )
        .replaceAll(
          /SKAdNetworkIdentifier:\s*'([^']+)'/g,
          'SKAdNetworkIdentifier: "$1"'
        );
      writeFileSync(path.join(tempRoot, 'app.config.ts'), appConfigSource);

      const result = runNativeAdConfigCheck(tempRoot);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('[ad-tracking-native-config] OK');
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
