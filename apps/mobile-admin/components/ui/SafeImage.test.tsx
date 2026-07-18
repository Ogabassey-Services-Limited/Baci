import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import type { ImageSourcePropType } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import SafeImage from './SafeImage';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native-svg', () => ({
  SvgUri: ({ uri }: { uri: string }) => <svg data-uri={uri} />,
  SvgXml: () => <svg />,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    chartColors: {},
    colors: {
      background: '#f8fafc',
      card: '#ffffff',
      textSecondary: '#64748b',
    },
    isDark: false,
    shadows: {},
  }),
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  return {
    useColorScheme: () => 'light',
    StatusBar: () => null,
    ActivityIndicator: () => <span data-testid="activity-indicator" />,
    Image: ({
      onError,
      source,
    }: {
      onError?: (event: { nativeEvent: { error: string } }) => void;
      source: unknown;
    }) => (
      <button
        data-source={JSON.stringify(source)}
        data-testid="native-image"
        onClick={() => onError?.({ nativeEvent: { error: 'load failed' } })}
        type="button"
      />
    ),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      flatten: (style: unknown) => style,
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement('div', null, children),
  };
});

class UriLike {
  constructor(private readonly href: string) {}

  toString() {
    return this.href;
  }
}

describe('SafeImage', () => {
  it('coerces a non-string object source uri before rendering native Image', () => {
    const source = {
      uri: new UriLike('file:///cache/product.png'),
    } as unknown as ImageSourcePropType;

    render(<SafeImage source={source} />);

    expect(screen.getByTestId('native-image')).toHaveAttribute(
      'data-source',
      JSON.stringify({ uri: 'file:///cache/product.png' })
    );
  });

  it('coerces non-string uri values inside array sources without changing strings', () => {
    const source = [
      { uri: new UriLike('file:///cache/fallback.png') },
      { uri: 'https://example.com/product.png' },
    ] as unknown as ImageSourcePropType;

    render(<SafeImage source={source} />);

    expect(screen.getByTestId('native-image')).toHaveAttribute(
      'data-source',
      JSON.stringify([
        { uri: 'file:///cache/fallback.png' },
        { uri: 'https://example.com/product.png' },
      ])
    );
  });

  it('does not mutate array source objects while sanitizing URI values', () => {
    const firstSource = { uri: new UriLike('file:///cache/fallback.png') };
    const secondSource = { uri: 'https://example.com/product.png' };
    const source = [
      firstSource,
      secondSource,
    ] as unknown as ImageSourcePropType;

    render(<SafeImage source={source} />);

    expect(firstSource.uri).toBeInstanceOf(UriLike);
    expect(secondSource.uri).toBe('https://example.com/product.png');

    expect(screen.getByTestId('native-image')).toHaveAttribute(
      'data-source',
      JSON.stringify([
        { uri: 'file:///cache/fallback.png' },
        { uri: 'https://example.com/product.png' },
      ])
    );
  });

  it('retries an original image source before showing the fallback icon', () => {
    render(
      <SafeImage
        fallbackSource={{ uri: 'https://project.supabase.co/original.png' }}
        source={{ uri: 'https://project.supabase.co/transformed.png' }}
      />
    );

    fireEvent.click(screen.getByTestId('native-image'));

    expect(screen.getByTestId('native-image')).toHaveAttribute(
      'data-source',
      JSON.stringify({ uri: 'https://project.supabase.co/original.png' })
    );
    expect(screen.queryByText('image-outline')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('native-image'));

    expect(screen.queryByTestId('native-image')).not.toBeInTheDocument();
    expect(screen.getByText('image-outline')).toBeInTheDocument();
  });
});
