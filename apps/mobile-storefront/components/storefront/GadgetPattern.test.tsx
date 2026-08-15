import { render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Image, StyleSheet } from 'react-native';
import { GadgetPattern } from './GadgetPattern';

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');
  return { LinearGradient: View };
});

describe('GadgetPattern', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders one gradient and one raster accent for the static backdrop', () => {
    const { getAllByTestId, UNSAFE_getAllByType } = render(
      <GadgetPattern height={1500} />
    );

    expect(getAllByTestId('tech-backdrop-gradient')).toHaveLength(1);
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
    expect(UNSAFE_getAllByType(Image)[0]?.props.resizeMode).toBe('contain');
  });

  it('uses light gradient stops for the light color scheme', () => {
    const { getByTestId } = render(
      <GadgetPattern colorScheme="light" height={1500} />
    );

    expect(getByTestId('tech-backdrop-gradient').props.colors).toEqual([
      'rgba(15,23,42,1)',
      'rgba(15,23,42,0.22)',
      'rgba(15,23,42,0)',
    ]);
  });

  it('uses dark gradient stops for the dark color scheme', () => {
    const { getByTestId } = render(
      <GadgetPattern colorScheme="dark" height={1500} />
    );

    expect(getByTestId('tech-backdrop-gradient').props.colors).toEqual([
      'rgba(255,255,255,1)',
      'rgba(255,255,255,0.24)',
      'rgba(255,255,255,0)',
    ]);
  });

  it('falls back to the active device color scheme', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const { getByTestId } = render(<GadgetPattern height={1500} />);

    expect(getByTestId('tech-backdrop-gradient').props.colors[0]).toBe(
      'rgba(255,255,255,1)'
    );
  });

  it('uses the compact raster accent for the tab bar variant', () => {
    const { UNSAFE_getByType } = render(<GadgetPattern variant="tabbar" />);

    expect(StyleSheet.flatten(UNSAFE_getByType(Image).props.style).height).toBe(
      96
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
