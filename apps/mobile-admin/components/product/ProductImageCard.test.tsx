import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductImageCard } from './ProductImageCard';

vi.mock('@/components/ui/SafeImage', () => ({
  __esModule: true,
  default: ({ source }: { source: { uri: string } }) => (
    <div aria-label="Product preview" data-src={source.uri} />
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'Uploading'),
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('ProductImageCard', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('shows the upload placeholder and triggers image selection', () => {
    const onPress = vi.fn();

    render(
      <ProductImageCard
        colors={colors}
        isUploading={false}
        onPress={onPress}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Product image' }));

    expect(screen.getByText('Tap to upload image')).toBeInTheDocument();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the selected image state', () => {
    render(
      <ProductImageCard
        colors={colors}
        imageUrl="https://example.com/image.jpg"
        isUploading={false}
        onPress={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Product preview')).toHaveAttribute(
      'data-src',
      'https://example.com/image.jpg'
    );
    expect(screen.getByText('Change Image')).toBeInTheDocument();
  });
});
