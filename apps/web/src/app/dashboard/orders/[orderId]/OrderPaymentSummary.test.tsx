import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderPaymentSummary } from './OrderPaymentSummary';

vi.mock('lucide-react', () => ({
  Download: () => <span aria-hidden="true" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

describe('OrderPaymentSummary', () => {
  it('shows the discount while keeping the persisted net order total', () => {
    render(
      <OrderPaymentSummary
        order={{
          currency: 'NGN',
          discount_amount: 1000,
          paymentMethod: 'card',
          payment_reference: 'pay-123',
          shipping_fee: 500,
          subtotal: 10000,
          tax_amount: 0,
          total: 9500,
        }}
      />
    );

    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('-₦1,000')).toBeInTheDocument();
    expect(screen.getByText('₦9,500')).toBeInTheDocument();
  });

  it('derives a subtotal when older orders do not have one persisted', () => {
    render(
      <OrderPaymentSummary
        order={{
          currency: 'NGN',
          discount_amount: 1000,
          paymentMethod: null,
          shipping_fee: 500,
          tax_amount: 0,
          total: 9500,
        }}
      />
    );

    expect(screen.getByText('₦10,000')).toBeInTheDocument();
  });
});
