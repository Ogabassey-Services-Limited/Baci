import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  APP_DELEGATE_TEMPLATE,
  applyExpoUpdatesCustomInit,
  ensureUpdatesCustomInit,
  findAppDelegatePath,
} from './withExpoUpdatesCustomInit';

describe('withExpoUpdatesCustomInit', () => {
  it('replaces the default AppDelegate with the custom expo-updates init flow', () => {
    const source = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {}
`;

    const result = applyExpoUpdatesCustomInit(source);

    expect(result).toBe(APP_DELEGATE_TEMPLATE);
    expect(result).toContain('AppController.initializeWithoutStarting()');
    expect(result).toContain(
      'window?.rootViewController = UpdatesEnabledRootViewController()'
    );
    expect(result).toContain('updatesController?.launchAssetUrl()');
  });

  it('enables updatesCustomInit without removing other Podfile properties', () => {
    const result = ensureUpdatesCustomInit(`{
  "expo.jsEngine": "hermes",
  "ios.useFrameworks": "static"
}
`);

    expect(JSON.parse(result)).toEqual({
      'expo.jsEngine': 'hermes',
      'ios.useFrameworks': 'static',
      updatesCustomInit: 'true',
    });
  });

  it('finds the single AppDelegate.swift in the iOS app directory', () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'baci-storefront-app-delegate-')
    );

    try {
      const iosDir = path.join(tempRoot, 'ios');
      const appDir = path.join(iosDir, 'Ogabassey');

      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, 'AppDelegate.swift'), 'placeholder');

      expect(findAppDelegatePath(iosDir)).toBe(
        path.join(appDir, 'AppDelegate.swift')
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('throws when multiple AppDelegate.swift files exist', () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'baci-storefront-app-delegate-conflict-')
    );

    try {
      const iosDir = path.join(tempRoot, 'ios');

      fs.mkdirSync(path.join(iosDir, 'AppOne'), { recursive: true });
      fs.mkdirSync(path.join(iosDir, 'AppTwo'), { recursive: true });
      fs.writeFileSync(path.join(iosDir, 'AppOne', 'AppDelegate.swift'), 'one');
      fs.writeFileSync(path.join(iosDir, 'AppTwo', 'AppDelegate.swift'), 'two');

      expect(() => findAppDelegatePath(iosDir)).toThrow(
        'Expected exactly one AppDelegate.swift in ios/, found 2'
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
