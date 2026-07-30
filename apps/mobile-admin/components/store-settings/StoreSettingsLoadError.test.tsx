import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { StoreSettingsLoadError } from './StoreSettingsLoadError';

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const colors = {
  background: '#000000',
  card: '#111111',
  primary: '#4d9de0',
  text: '#ffffff',
} as ThemeColors;

describe('StoreSettingsLoadError', () => {
  it('lets the merchant retry loading settings', () => {
    const onRetry = vi.fn();

    render(<StoreSettingsLoadError colors={colors} onRetry={onRetry} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading store settings' })
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
