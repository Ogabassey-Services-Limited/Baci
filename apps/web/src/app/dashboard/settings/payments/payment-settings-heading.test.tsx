import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentSettingsHeading } from './payment-settings-heading';

describe('PaymentSettingsHeading', () => {
  it('introduces gateway, delivery-payment, and settlement configuration', () => {
    render(<PaymentSettingsHeading />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Payment Settings' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Configure payment gateways, delivery payments, and settlement details'
      )
    ).toBeInTheDocument();
  });
});
