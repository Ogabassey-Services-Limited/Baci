import { Platform } from 'react-native';
import { describe, expect, it } from 'vitest';
import {
  getRuntimePlatform,
  isRuntimePlatform,
  selectRuntimePlatform,
} from './runtime-platform';

describe('runtime-platform', () => {
  it('reads the active runtime platform from React Native', () => {
    expect(getRuntimePlatform()).toBe(Platform.OS);
  });

  it('compares runtime platform correctly', () => {
    expect(isRuntimePlatform(getRuntimePlatform())).toBe(true);
  });

  it('selects platform-specific values with fallback support', () => {
    expect(
      selectRuntimePlatform(
        { ios: 'i', android: 'a', web: 'w', default: 'd' },
        'ios'
      )
    ).toBe('i');
    expect(
      selectRuntimePlatform(
        { ios: 'i', android: 'a', web: 'w', default: 'd' },
        'android'
      )
    ).toBe('a');
    expect(
      selectRuntimePlatform(
        { ios: 'i', android: 'a', web: 'w', default: 'd' },
        'web'
      )
    ).toBe('w');
    expect(selectRuntimePlatform({ default: 'd' }, 'windows')).toBe('d');
  });
});
