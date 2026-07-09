import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TaxRegionUnavailableCard } from './TaxRegionUnavailableCard';
import type { TaxCardShadow, TaxColors } from './types';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('TaxRegionUnavailableCard', () => {
  const colors = {
    card: '#ffffff',
    cardHover: '#f1f5f9',
    text: '#0f172a',
    textSecondary: '#64748b',
  } as unknown as TaxColors;

  const shadowStyle = {
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  } satisfies TaxCardShadow;

  it('explains that tax settings are Nigeria-only without rendering a form', () => {
    render(<TaxRegionUnavailableCard colors={colors} shadowStyle={shadowStyle} />);

    expect(screen.getByText('Tax settings unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tax settings are currently available for Nigerian merchants only — support for your region is coming.'
      )
    ).toBeInTheDocument();
  });
});
