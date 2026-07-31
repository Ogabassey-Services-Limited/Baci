import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DARK_COLORS } from '@/constants/theme';
import { AnalyticsInfoBanner } from './AnalyticsInfoBanner';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('AnalyticsInfoBanner', () => {
  it('explains server-side tracking and automatic conversion reporting', () => {
    render(<AnalyticsInfoBanner colors={DARK_COLORS} />);

    expect(screen.getByText('Server-Side Tracking')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Configure CAPI tokens to track conversions even when customers use ad blockers. Your orders will be automatically reported to ad platforms.'
      )
    ).toBeInTheDocument();
  });
});
