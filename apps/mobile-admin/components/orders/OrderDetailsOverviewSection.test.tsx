import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetailsOverviewSection } from './OrderDetailsOverviewSection';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('./OrderDetailsStatusCard', () => ({
  OrderDetailsStatusCard: ({ shippingStatus }: { shippingStatus: string }) => (
    <div aria-label="status-card" data-shipping-status={shippingStatus} />
  ),
}));

vi.mock('./OrderDetailsCustomerCard', () => ({
  OrderDetailsCustomerCard: ({ customerName }: { customerName: string }) => (
    <div aria-label="customer-card" data-customer-name={customerName} />
  ),
}));

describe('OrderDetailsOverviewSection', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  };

  const baseProps: React.ComponentProps<typeof OrderDetailsOverviewSection> = {
    colors: colors as unknown as React.ComponentProps<
      typeof OrderDetailsOverviewSection
    >['colors'],
    createdAtLabel: 'Apr 21, 2026',
    customerEmail: 'jane@example.com',
    customerName: 'Jane Doe',
    customerPhone: '+2348012345678',
    isGeneratingReceipt: false,
    onCall: vi.fn(),
    onEmail: vi.fn(),
    onSendOrderDetailsToRider: vi.fn(),
    onSendReceipt: vi.fn(),
    onSendRiderToCustomer: vi.fn(),
    onWhatsApp: vi.fn(),
    recordedByName: null,
    shippingColor: '#ca8a04',
    shippingConfig: { icon: 'time', label: 'Pending' },
    shippingStatus: 'pending',
    showPostShipmentActions: false,
    source: null,
    sourceInfo: {
      color: '#64748b',
      label: 'Dashboard',
      name: 'dashboard',
    },
    updatedAtLabel: 'Apr 21, 2026',
  };

  it('renders both the status card and the customer card', () => {
    render(<OrderDetailsOverviewSection {...baseProps} />);

    expect(screen.getByLabelText('status-card')).toBeInTheDocument();
    expect(screen.getByLabelText('customer-card')).toBeInTheDocument();
  });

  it('passes the customer name through to the customer card', () => {
    render(<OrderDetailsOverviewSection {...baseProps} />);

    expect(screen.getByLabelText('customer-card')).toHaveAttribute(
      'data-customer-name',
      'Jane Doe'
    );
  });

  it('passes the shipping status through to the status card', () => {
    render(
      <OrderDetailsOverviewSection {...baseProps} shippingStatus="processing" />
    );

    expect(screen.getByLabelText('status-card')).toHaveAttribute(
      'data-shipping-status',
      'processing'
    );
  });
});
