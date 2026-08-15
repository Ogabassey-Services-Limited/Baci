import { render } from '@testing-library/react-native';
import { Image, Platform, StyleSheet } from 'react-native';
import Svg from 'react-native-svg';
import { GadgetPattern } from './GadgetPattern';

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');
  return { LinearGradient: View };
});

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

  it('replaces the SVG tree with one raster accent on current Android', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      value: 29,
    });

    const { UNSAFE_queryByType, UNSAFE_getByType } = render(
      <GadgetPattern height={1500} />
    );

    expect(UNSAFE_queryByType(Svg)).toBeNull();
    expect(UNSAFE_getByType(Image).props.resizeMode).toBe('contain');
  });

  it('uses distinct light and dark gradient treatments', () => {
    const light = render(<GadgetPattern colorScheme="light" height={1500} />);
    const dark = render(<GadgetPattern colorScheme="dark" height={1500} />);

    expect(light.getByTestId('tech-backdrop-gradient')).not.toHaveProp(
      'colors',
      dark.getByTestId('tech-backdrop-gradient').props.colors
    );
  });

  it('applies the requested opacity to the gradient and raster accent', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <GadgetPattern height={1500} opacity={0.04} />
    );

    expect(getByTestId('tech-backdrop-gradient')).toHaveStyle({
      opacity: 0.04,
    });
    expect(
      StyleSheet.flatten(UNSAFE_getByType(Image).props.style).opacity
    ).toBe(0.04);
  });
});
