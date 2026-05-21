import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import PaywallHeader from './PaywallHeader';

const mocks = vi.hoisted(() => ({
  gradientColors: [] as string[],
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({
    children,
    colors,
  }: {
    children?: ReactNode;
    colors?: string[];
  }) => {
    mocks.gradientColors = colors ?? [];
    return <div>{children}</div>;
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native', () => ({
  Pressable: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));

const baseColors = {
  primary: '#3B82F6',
} as ThemeColors;

describe('PaywallHeader', () => {
  afterEach(() => {
    mocks.gradientColors = [];
  });

  it('uses theme-derived gradient stops instead of hardcoded red', () => {
    render(
      <PaywallHeader
        closeButtonTop={30}
        colors={baseColors}
        headerPaddingTop={50}
        onClose={() => undefined}
      />
    );

    expect(mocks.gradientColors).toEqual(['#3B82F6', '#234e94']);
  });

  it('falls back to the original primary value for non-hex theme colors', () => {
    render(
      <PaywallHeader
        closeButtonTop={30}
        colors={{ ...baseColors, primary: 'rgb(59, 130, 246)' }}
        headerPaddingTop={50}
        onClose={() => undefined}
      />
    );

    expect(mocks.gradientColors).toEqual([
      'rgb(59, 130, 246)',
      'rgb(59, 130, 246)',
    ]);
  });
});
