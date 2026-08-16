import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { SafeImage } from './SafeImage';

let mockColorScheme: 'dark' | 'light' | null = 'light';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

jest.mock('@react-native-vector-icons/ionicons', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return function MockIonicons({
    color,
    name,
  }: {
    color: string;
    name: string;
  }) {
    return <Text testID="fallback-icon">{`${name}:${color}`}</Text>;
  };
});

jest.mock('expo-image', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    Image: ({
      onError,
      autoplay,
      accessibilityLabel,
      testID,
    }: {
      onError?: (error: { error: string }) => void;
      autoplay?: boolean;
      accessibilityLabel?: string;
      testID?: string;
    }) => {
      const viewProps = {
        testID,
        onError,
        autoplay,
        accessible: true,
        accessibilityRole: 'image',
        accessibilityLabel,
      } as unknown as React.ComponentProps<typeof View>;
      return <View {...viewProps} />;
    },
  };
});

describe('SafeImage', () => {
  beforeEach(() => {
    mockColorScheme = 'light';
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the active theme tokens for the fallback background and icon', () => {
    mockColorScheme = 'dark';

    render(
      <SafeImage
        testID="product-image"
        source={{ uri: 'https://example.com/missing.png' }}
      />
    );

    fireEvent(screen.getByTestId('product-image'), 'error', {
      error: 'not found',
    });

    const fallback = screen.getByLabelText('Image unavailable');
    expect(StyleSheet.flatten(fallback.props.style)).toMatchObject({
      backgroundColor: Colors.dark.muted,
    });
    expect(screen.getByTestId('fallback-icon').props.children).toBe(
      `image-outline:${Colors.dark.textSecondary}`
    );
  });

  it('does not autoplay animated remote images', () => {
    render(
      <SafeImage
        testID="product-image"
        accessibilityLabel="catalog image"
        source={{ uri: 'https://example.com/catalog.gif' }}
      />
    );

    expect(
      screen.getByRole('image', { name: 'catalog image' }).props.autoplay
    ).toBe(false);
  });

  it('lets callers override the fallback icon color', () => {
    render(
      <SafeImage
        testID="product-image"
        source={{ uri: 'https://example.com/missing.png' }}
        fallbackIconColor="#123456"
      />
    );

    fireEvent(screen.getByTestId('product-image'), 'error', {
      error: 'not found',
    });

    expect(screen.getByTestId('fallback-icon').props.children).toBe(
      'image-outline:#123456'
    );
  });
});
