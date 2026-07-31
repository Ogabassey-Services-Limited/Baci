import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DARK_COLORS, SHADOWS } from '@/constants/theme';
import { OfflineConversionsCard } from './OfflineConversionsCard';

vi.mock('react-native', () => ({
  Pressable: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={onPress} type="button">
      {children}
    </button>
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

    fireEvent.click(screen.getByRole('button'));

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

    fireEvent.click(screen.getByRole('button'));

    expect(onChange).toHaveBeenCalledWith('offline_conversions_enabled', false);
  });
});
