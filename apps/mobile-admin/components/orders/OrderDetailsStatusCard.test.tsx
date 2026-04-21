import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SHIPPING_STATUS_CONFIG } from '@baci/shared';
import type { ThemeColors } from '@/constants/theme';
import { OrderDetailsStatusCard } from './OrderDetailsStatusCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => (
    <span data-icon={name} />
  ),
}));

describe('OrderDetailsStatusCard', () => {
  const colors = {
    border: '#1e293b',
    card: '#0f172a',
    inputBg: '#111827',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    textOnPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
  } as unknown as ThemeColors;

  it('renders timeline labels and icons from each step config instead of reusing the current status config', () => {
    const { container } = render(
      <OrderDetailsStatusCard
        colors={colors}
        createdAtLabel="Apr 20, 2026"
        shippingColor="#2563eb"
        shippingConfig={SHIPPING_STATUS_CONFIG.shipped}
        shippingStatus="shipped"
        source="website"
        sourceInfo={{
          color: '#64748b',
          label: 'Website',
          name: 'globe-outline',
        }}
        updatedAtLabel="Apr 21, 2026"
      />
    );

    expect(screen.getByText('Unfulfilled')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getAllByText('Shipped')).toHaveLength(2);
    expect(screen.getByText('Delivered')).toBeInTheDocument();

    const iconNames = Array.from(container.querySelectorAll('[data-icon]')).map(
      (node) => node.getAttribute('data-icon')
    );

    expect(iconNames).toEqual(
      expect.arrayContaining([
        'receipt-outline',
        'construct-outline',
        'car-outline',
        'checkmark-done-outline',
      ])
    );
  });
});
