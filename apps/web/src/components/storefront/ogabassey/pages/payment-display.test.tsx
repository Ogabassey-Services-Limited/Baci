import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentDisplay } from './payment-display';

describe('PaymentDisplay', () => {
  it('renders a fallback label when no provider exists', () => {
    render(<PaymentDisplay />);

    expect(screen.getByText('Not Specified')).toBeInTheDocument();
  });

  it('applies the provider badge styling for paystack', () => {
    render(<PaymentDisplay provider="Paystack" />);

    expect(screen.getByText('Paystack')).toHaveClass('bg-blue-50');
    expect(screen.getByText('Paystack')).toHaveClass('text-blue-700');
  });
});
