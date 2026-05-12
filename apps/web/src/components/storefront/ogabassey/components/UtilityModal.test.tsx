import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UtilityModal } from './UtilityModal';
import { toast } from '@/hooks/use-toast';

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('./utility/AirtimeDataForm', () => ({
  AirtimeDataForm: ({ type, loading, onSubmit }: { type: string; loading: boolean; onSubmit: (data: Record<string, unknown>) => void }) => (
    <div data-testid="airtime-data-form" data-type={type} data-loading={String(loading)}>
      <button onClick={() => onSubmit({ phoneNumber: '08012345678', amount: 100, networkProvider: 'MTN' })}>Mock Submit</button>
    </div>
  ),
}));

vi.mock('./utility/BillPaymentForm', () => ({
  BillPaymentForm: ({ type, loading, onSubmit }: { type: string; loading: boolean; onSubmit: (data: Record<string, unknown>) => void }) => (
    <div data-testid="bill-payment-form" data-type={type} data-loading={String(loading)}>
      <button onClick={() => onSubmit({ amount: 5000, billItemIdentifier: 'DSTV', customerIdentifier: '123', billerName: 'DStv', type: 'cable_tv' })}>Mock Bill Submit</button>
    </div>
  ),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ merchant: { slug: 'ogabassey' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('UtilityModal', () => {
  const mockOnClose = vi.fn();
  const mockToast = vi.mocked(toast);

  beforeEach(() => {
    mockOnClose.mockClear();
    mockToast.mockClear();
    mockFetch.mockClear();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <UtilityModal
        isOpen={false}
        onClose={mockOnClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modal with header "Utility Payment" when open', () => {
    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Utility Payment')).toBeInTheDocument();
  });

  it('shows all 5 tab buttons', () => {
    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Airtime')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Power')).toBeInTheDocument();
    expect(screen.getByText('Betting')).toBeInTheDocument();
  });

  it('renders AirtimeDataForm for airtime tab (default)', () => {
    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const airtimeForm = screen.getByTestId('airtime-data-form');
    expect(airtimeForm).toBeInTheDocument();
    expect(airtimeForm).toHaveAttribute('data-type', 'airtime');
  });

  it('switches to BillPaymentForm when TV tab clicked', () => {
    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const tvTab = screen.getByText('TV');
    fireEvent.click(tvTab);

    const billForm = screen.getByTestId('bill-payment-form');
    expect(billForm).toBeInTheDocument();
    expect(billForm).toHaveAttribute('data-type', 'tv');
  });

  it('shows success screen after successful purchase', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        reference: 'REF123456',
        amount: 100,
      }),
    });

    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const submitButton = screen.getByText('Mock Submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('Your transaction has been processed successfully.')).toBeInTheDocument();
      expect(screen.getByText('REF123456')).toBeInTheDocument();
    });
  });

  it('calls toast on successful purchase', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        reference: 'REF123456',
        amount: 100,
      }),
    });

    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const submitButton = screen.getByText('Mock Submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Purchase Successful',
        description: 'Your airtime purchase was successful!',
      });
    });
  });

  it('shows error toast on failed purchase', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: 'Insufficient funds',
      }),
    });

    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const submitButton = screen.getByText('Mock Submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Transaction Failed',
        description: 'Insufficient funds',
        variant: 'destructive',
      });
    });
  });

  it('close button calls onClose', () => {
    render(
      <UtilityModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
