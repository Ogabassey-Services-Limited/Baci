import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import Svg from 'react-native-svg';
import { GadgetPattern } from './GadgetPattern';

describe('GadgetPattern', () => {
  const originalOS = Platform.OS;
  const originalVersion = Platform.Version;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalOS,
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: originalVersion,
    });
  });

  it('does not mount the expensive SVG pattern on Android 9', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 28,
    });

    const { UNSAFE_queryByType } = render(<GadgetPattern height={1500} />);

    expect(UNSAFE_queryByType(Svg)).toBeNull();
  });

  it('keeps the SVG pattern on supported Android versions', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 29,
    });

    const { UNSAFE_queryByType } = render(<GadgetPattern height={1500} />);

    expect(UNSAFE_queryByType(Svg)).not.toBeNull();
  });
});
