import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NegotiationItemMetaChips } from './NegotiationItemMetaChips';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({
      accessibilityLabel,
      children,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        'div',
        accessibilityLabel ? { 'aria-label': accessibilityLabel } : null,
        children
      ),
  };
});

const colors = {
  backgroundLight: '#0f172a',
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
};

describe('NegotiationItemMetaChips', () => {
  it('renders each selected option as a clear label and value', () => {
    render(
      <NegotiationItemMetaChips
        colors={colors}
        metadata="Storage: 256GB · Color: Deep Purple · SIM type: Dual SIM"
      />
    );

    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('256GB')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Deep Purple')).toBeInTheDocument();
    expect(screen.getByText('SIM type')).toBeInTheDocument();
    expect(screen.getByText('Dual SIM')).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        'Selected options: Storage: 256GB, Color: Deep Purple, SIM type: Dual SIM'
      )
    ).toBeInTheDocument();
  });

  it('labels a saved option name as the variant', () => {
    render(
      <NegotiationItemMetaChips colors={colors} metadata="16GB / 512GB SSD" />
    );

    expect(screen.getByText('Variant')).toBeInTheDocument();
    expect(screen.getByText('16GB / 512GB SSD')).toBeInTheDocument();
  });
});
