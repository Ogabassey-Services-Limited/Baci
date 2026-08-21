import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const configSource = readFileSync(
  resolve(__dirname, 'babel.config.js'),
  'utf8'
);

describe('mobile-admin Babel configuration', () => {
  it('leaves React Compiler configuration to Expo SDK 57 app config', () => {
    expect(configSource).not.toContain('babel-plugin-react-compiler');
  });

  it('retains worklets bundle mode for the native runtime', () => {
    expect(configSource).toContain(
      "['react-native-worklets/plugin', { bundleMode: true }]"
    );
  });
});
