import { describe, expect, it } from 'vitest';
import { getReactNativeDomStyle } from './react-native-dom-style';

describe('getReactNativeDomStyle', () => {
  it('returns object styles unchanged', () => {
    expect(getReactNativeDomStyle({ opacity: 0.5 })).toEqual({ opacity: 0.5 });
  });

  it('merges array styles and skips empty entries', () => {
    expect(
      getReactNativeDomStyle([{ color: 'red' }, null, { fontSize: 16 }])
    ).toEqual({
      color: 'red',
      fontSize: 16,
    });
  });

  it('returns undefined for primitive styles', () => {
    expect(getReactNativeDomStyle('not-style')).toBeUndefined();
  });
});
