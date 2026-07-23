import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const ensurePatchedReactNativeBuild =
  require('./ensurePatchedReactNativeBuild.js') as (content: string) => string;

describe('ensurePatchedReactNativeBuild', () => {
  it('adds React Native composite dependency substitutions once', () => {
    const initial = "include ':app'\n";

    const first = ensurePatchedReactNativeBuild(initial);
    const second = ensurePatchedReactNativeBuild(first);

    expect(first).toContain("require.resolve('react-native/package.json')");
    expect(first).toContain(
      'substitute(module("com.facebook.react:react-android"))'
    );
    expect(first).toContain('project(":packages:react-native:ReactAndroid")');
    expect(second).toBe(first);
  });
});
