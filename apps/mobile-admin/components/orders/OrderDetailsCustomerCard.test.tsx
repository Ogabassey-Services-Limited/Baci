import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  function renderCard(
    overrides: Partial<
      React.ComponentProps<typeof OrderDetailsCustomerCard>
    > = {}
  ) {
    const props = {
      colors,
      customerEmail: 'customer@example.com',
      customerName: 'Ada',
      customerPhone: null,
      isGeneratingReceipt: false,
      onCall: vi.fn(),
      onEmail: vi.fn(),
      onSendOrderDetailsToRider: vi.fn(),
      onSendReceipt: vi.fn(),
      onSendRiderToCustomer: vi.fn(),
      onWhatsApp: vi.fn(),
      showPostShipmentActions: true,
      ...overrides,
    };

    return {
      ...render(<OrderDetailsCustomerCard {...props} />),
      props,
    };
  }

  it('keeps the rider action visible after shipment even when the customer phone is missing', () => {
    renderCard();

    expect(
      screen.getByRole('button', { name: /send order details to rider/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /share rider details with customer/i,
      })
    ).not.toBeInTheDocument();
  });

  it('shows the share-rider action when the customer phone exists', () => {
    renderCard({ customerPhone: '+1234567890' });

    expect(
      screen.getByRole('button', {
        name: /share rider details with customer/i,
      })
    ).toBeInTheDocument();
  });

  it('forwards the customer action handlers', () => {
    const { props } = renderCard({ customerPhone: '+1234567890' });

    fireEvent.click(screen.getByRole('button', { name: /call customer/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /message customer on whatsapp/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /email customer/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /send receipt to customer/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /send order details to rider/i })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /share rider details with customer/i,
      })
    );

    expect(props.onCall).toHaveBeenCalledTimes(1);
    expect(props.onWhatsApp).toHaveBeenCalledTimes(1);
    expect(props.onEmail).toHaveBeenCalledTimes(1);
    expect(props.onSendReceipt).toHaveBeenCalledTimes(1);
    expect(props.onSendOrderDetailsToRider).toHaveBeenCalledTimes(1);
    expect(props.onSendRiderToCustomer).toHaveBeenCalledTimes(1);
  });

  it('disables receipt sending while the receipt is generating', () => {
    renderCard({ isGeneratingReceipt: true });

    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send receipt to customer/i })
    ).toBeDisabled();
  });

  it('hides post-shipment actions when post-shipment mode is disabled', () => {
    renderCard({
      customerPhone: '+1234567890',
      showPostShipmentActions: false,
    });

    expect(
      screen.queryByRole('button', { name: /send order details to rider/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /share rider details with customer/i,
      })
    ).not.toBeInTheDocument();
  });
});
