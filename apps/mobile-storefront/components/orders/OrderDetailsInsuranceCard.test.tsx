import { fireEvent, render, screen } from '@testing-library/react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { OrderDetailsInsuranceCard } from './OrderDetailsInsuranceCard';

const colors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('OrderDetailsInsuranceCard', () => {
  it('renders active policy details and opens its certificate', () => {
    const onOpenCertificate = jest.fn();

    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          certificate_url: 'https://cdn.example.com/policy.pdf',
          claim_status: 'approved',
          coverage_amount: 250000,
          mycover_policy_number: 'MC-2048',
          policy_expiry_date: null,
          policy_start_date: null,
          policy_type: null,
          premium_amount: 2500,
          provider_name: 'Sovereign Trust',
          status: 'active',
        }}
        isPaid
        onOpenCertificate={onOpenCertificate}
      />
    );

    expect(screen.getByText('Insurance Coverage')).toBeTruthy();
    expect(screen.getByText('MC-2048')).toBeTruthy();
    expect(screen.getByText(formatNgnCurrency(250000))).toBeTruthy();
    expect(screen.getByText('approved')).toBeTruthy();
    expect(screen.getByText(/Sovereign Trust/)).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Download insurance certificate',
      })
    );
    expect(onOpenCertificate).toHaveBeenCalledWith(
      'https://cdn.example.com/policy.pdf'
    );
  });

  it('renders a pending policy message only for paid assurance orders', () => {
    const { rerender } = render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={null}
        isPaid
        onOpenCertificate={jest.fn()}
      />
    );

    expect(
      screen.getByText('Your shipping protection is being processed...')
    ).toBeTruthy();

    rerender(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={null}
        isPaid={false}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.queryByText('Insurance Coverage')).toBeNull();
  });
});
