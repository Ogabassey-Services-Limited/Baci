import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

describe('SDK 55 compliance', () => {
  it('app.config.ts does not contain newArchEnabled (removed in SDK 55)', () => {
    const configSource = readFileSync(
      path.join(ROOT, 'app.config.ts'),
      'utf-8'
    );
    expect(configSource).not.toContain('newArchEnabled');
  });

  it('gradle.properties does not contain newArchEnabled', () => {
    const gradleProps = readFileSync(
      path.join(ROOT, 'android/gradle.properties'),
      'utf-8'
    );
    expect(gradleProps).not.toContain('newArchEnabled');
  });

  it('Podfile.properties.json does not contain newArchEnabled', () => {
    const podfileProps = readFileSync(
      path.join(ROOT, 'ios/Podfile.properties.json'),
      'utf-8'
    );
    expect(podfileProps).not.toContain('newArchEnabled');
  });

  it('package.json does not contain expo-av (removed in SDK 55)', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf-8')
    );
    expect(pkg.dependencies).not.toHaveProperty('expo-av');
  });

  it('package.json does not contain expo-blur (unused)', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf-8')
    );
    expect(pkg.dependencies).not.toHaveProperty('expo-blur');
  });
});
