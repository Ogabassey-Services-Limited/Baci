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
          claim_comment: null,
          claim_link: null,
          claim_stage: null,
          claim_status: 'approved',
          coverage_amount: 250000,
          inspection_link: null,
          inspection_status: 'pending',
          mycover_policy_number: 'MC-2048',
          policy_expiry_date: null,
          policy_start_date: null,
          policy_type: null,
          premium_amount: 2500,
          provider_name: 'Sovereign Trust',
          status: 'active',
        }}
        isDelivered
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
        isDelivered
        isPaid
        onOpenCertificate={jest.fn()}
      />
    );

    expect(
      screen.getByText('Your shipping protection is being processed…')
    ).toBeTruthy();

    rerender(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={null}
        isDelivered
        isPaid={false}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.queryByText('Insurance Coverage')).toBeNull();
  });

  const policyWithLinks = {
    certificate_url: null,
    claim_comment: null,
    claim_link: 'https://mycover.ai/purchase?q=claim',
    claim_stage: null,
    claim_status: 'pending',
    coverage_amount: 250000,
    inspection_link: 'https://mycover.ai/purchase?q=inspect',
    inspection_status: 'pending',
    mycover_policy_number: 'MC-2048',
    policy_expiry_date: null,
    policy_start_date: null,
    policy_type: null,
    premium_amount: 2500,
    provider_name: 'Sovereign Trust',
    status: 'active',
  } as const;

  const inspectionLabel = 'Activate protection with a device inspection';
  const claimLabel = 'File an insurance claim';

  it('hides Activate Protection until the order is delivered', () => {
    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{ ...policyWithLinks, claim_status: null }}
        isDelivered={false}
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={jest.fn()}
        onOpenCertificate={jest.fn()}
      />
    );

    // Neither activation nor claim is available before delivery.
    expect(screen.queryByRole('button', { name: inspectionLabel })).toBeNull();
    expect(screen.queryByRole('button', { name: claimLabel })).toBeNull();
    expect(
      screen.getByText(/Protection activates after delivery/)
    ).toBeTruthy();
  });

  it('shows Activate Protection (not claim) once delivered and inspection pending', () => {
    const onCompleteInspection = jest.fn();

    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={policyWithLinks}
        isDelivered
        isPaid
        onCompleteInspection={onCompleteInspection}
        onFileClaim={jest.fn()}
        onOpenCertificate={jest.fn()}
      />
    );

    // Claim is gated until inspection completes.
    expect(screen.queryByRole('button', { name: claimLabel })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: inspectionLabel }));
    expect(onCompleteInspection).toHaveBeenCalledWith(
      'https://mycover.ai/purchase?q=inspect'
    );
  });

  it('switches to File a Claim once inspection is completed', () => {
    const onFileClaim = jest.fn();

    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          ...policyWithLinks,
          claim_status: null,
          inspection_status: 'completed',
        }}
        isDelivered
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={onFileClaim}
        onOpenCertificate={jest.fn()}
      />
    );

    // Inspection prompt is gone once completed.
    expect(screen.queryByRole('button', { name: inspectionLabel })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: claimLabel }));
    expect(onFileClaim).toHaveBeenCalledWith(
      'https://mycover.ai/purchase?q=claim'
    );
  });

  it('shows claim directly when a claim-only policy has no inspection link', () => {
    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          ...policyWithLinks,
          claim_status: null,
          inspection_link: null,
        }}
        isDelivered={false}
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={jest.fn()}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: inspectionLabel })).toBeNull();
    expect(screen.getByRole('button', { name: claimLabel })).toBeTruthy();
  });

  it('shows Continue Claim when a non-terminal MyCover claim already exists', () => {
    const onFileClaim = jest.fn();

    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          ...policyWithLinks,
          claim_stage: 'Offer sent',
          claim_status: 'offer_sent',
          inspection_status: 'completed',
        }}
        isDelivered
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={onFileClaim}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: claimLabel })).toBeNull();
    fireEvent.press(
      screen.getByRole('button', { name: 'Continue insurance claim' })
    );
    expect(onFileClaim).toHaveBeenCalledWith(
      'https://mycover.ai/purchase?q=claim'
    );
    expect(screen.getByText('Offer sent')).toBeTruthy();
  });

  it('hides Continue Claim for terminal MyCover claim states', () => {
    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          ...policyWithLinks,
          claim_stage: 'Paid',
          claim_status: 'paid',
          inspection_status: 'completed',
        }}
        isDelivered
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={jest.fn()}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: claimLabel })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Continue insurance claim' })
    ).toBeNull();
    expect(screen.getByText('Paid')).toBeTruthy();
  });

  it('renders delivery-pending activation copy with a literal apostrophe', () => {
    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          ...policyWithLinks,
          claim_link: null,
          claim_status: null,
          inspection_status: 'pending',
        }}
        isDelivered={false}
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={jest.fn()}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.getByText(/you'll be able to/i)).toBeTruthy();
    expect(screen.queryByText(/you&apos;ll/i)).toBeNull();
  });

  it('holds mobile claims while pending inspection links have not arrived', () => {
    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          ...policyWithLinks,
          claim_link: null,
          claim_status: null,
          inspection_link: null,
          inspection_status: 'pending',
        }}
        isDelivered
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={jest.fn()}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: inspectionLabel })).toBeNull();
    expect(screen.queryByRole('button', { name: claimLabel })).toBeNull();
    expect(screen.getByText(/Protection activation is pending/i)).toBeTruthy();
  });

  it('hides both actions when no hosted links exist', () => {
    render(
      <OrderDetailsInsuranceCard
        colors={colors}
        hasAssuranceItems
        insurancePolicy={{
          ...policyWithLinks,
          claim_link: null,
          inspection_link: null,
        }}
        isDelivered
        isPaid
        onCompleteInspection={jest.fn()}
        onFileClaim={jest.fn()}
        onOpenCertificate={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: claimLabel })).toBeNull();
    expect(screen.queryByRole('button', { name: inspectionLabel })).toBeNull();
    expect(
      screen.queryByText(/Protection activation is pending/i)
    ).toBeNull();
    expect(screen.getByText('pending')).toBeTruthy();
  });
});
