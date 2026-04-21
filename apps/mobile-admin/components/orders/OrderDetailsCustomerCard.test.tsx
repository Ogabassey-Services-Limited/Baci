import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { OrderDetailsCustomerCard } from './OrderDetailsCustomerCard';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Pressable: ({
      children,
      disabled,
      onPress,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          disabled,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('OrderDetailsCustomerCard', () => {
  const colors = {
    backgroundLight: '#f8fafc',
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    success: '#16a34a',
    text: '#0f172a',
    textMuted: '#94a3b8',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as ThemeColors;

  it('keeps the rider action visible after shipment even when the customer phone is missing', () => {
    render(
      <OrderDetailsCustomerCard
        colors={colors}
        customerEmail="customer@example.com"
        customerName="Ada"
        customerPhone={null}
        isGeneratingReceipt={false}
        onCall={vi.fn()}
        onEmail={vi.fn()}
        onSendOrderDetailsToRider={vi.fn()}
        onSendReceipt={vi.fn()}
        onSendRiderToCustomer={vi.fn()}
        onWhatsApp={vi.fn()}
        showPostShipmentActions={true}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Send Order Details to Rider' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Share Rider Details With Customer',
      })
    ).not.toBeInTheDocument();
  });
});
