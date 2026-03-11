import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  APP_DELEGATE_TEMPLATE,
  APP_DELEGATE_TEMPLATE_PATH,
  applyExpoUpdatesCustomInit,
  ensureUpdatesCustomInit,
  findAppDelegatePath,
  readFileOrDefault,
} from './withExpoUpdatesCustomInit';

const ROOT = path.resolve(__dirname, '..');

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

  it('keeps the shared AppDelegate template in sync with the committed iOS file', () => {
    const iosDir = path.join(ROOT, 'ios');
    const committedAppDelegatePath = findAppDelegatePath(iosDir);
    const committedAppDelegateSource = fs.readFileSync(
      committedAppDelegatePath,
      'utf8'
    );
    const templateSource = fs.readFileSync(APP_DELEGATE_TEMPLATE_PATH, 'utf8');

    expect(templateSource).toBe(APP_DELEGATE_TEMPLATE);
    expect(committedAppDelegateSource).toBe(templateSource);
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

  it('ensureUpdatesCustomInit throws a clear error for malformed Podfile.properties.json', () => {
    expect(() => ensureUpdatesCustomInit('{ invalid json')).toThrow(
      'Malformed Podfile.properties.json:'
    );
  });

  it('returns a default value when a file is missing', () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'baci-storefront-missing-file-')
    );

    try {
      const filePath = path.join(tempRoot, 'Podfile.properties.json');

      expect(readFileOrDefault(filePath, '{}\n')).toBe('{}\n');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
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

  it('throws when no AppDelegate.swift files exist', () => {
    const tempRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'baci-storefront-app-delegate-missing-')
    );

    try {
      const iosDir = path.join(tempRoot, 'ios');

      fs.mkdirSync(path.join(iosDir, 'Ogabassey'), { recursive: true });

      expect(() => findAppDelegatePath(iosDir)).toThrow(
        'Expected exactly one AppDelegate.swift in ios/, found 0'
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
