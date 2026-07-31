import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DARK_COLORS, SHADOWS } from '@/constants/theme';
import { OfflineConversionsCard } from './OfflineConversionsCard';

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    onPress,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { checked?: boolean };
    onPress?: () => void;
  }) => (
    <input
      aria-label={accessibilityLabel}
      checked={accessibilityState?.checked}
      onChange={onPress}
      role={accessibilityRole}
      type="checkbox"
    />
  ),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('OfflineConversionsCard', () => {
  it('enables offline conversions when the currently disabled toggle is pressed', () => {
    const onChange = vi.fn();

    render(
      <OfflineConversionsCard
        colors={DARK_COLORS}
        enabled={false}
        onChange={onChange}
        shadows={SHADOWS}
      />
    );

    fireEvent.click(
      screen.getByRole('switch', {
        checked: false,
        name: 'Auto-upload conversions',
      })
    );

    expect(onChange).toHaveBeenCalledWith('offline_conversions_enabled', true);
  });

  it('disables offline conversions when the currently enabled toggle is pressed', () => {
    const onChange = vi.fn();

    render(
      <OfflineConversionsCard
        colors={DARK_COLORS}
        enabled={true}
        onChange={onChange}
        shadows={SHADOWS}
      />
    );

    fireEvent.click(
      screen.getByRole('switch', {
        checked: true,
        name: 'Auto-upload conversions',
      })
    );

    expect(onChange).toHaveBeenCalledWith('offline_conversions_enabled', false);
  });
});
