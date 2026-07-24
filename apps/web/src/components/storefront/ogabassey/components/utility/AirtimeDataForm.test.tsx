import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AirtimeDataForm } from './AirtimeDataForm';

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('@/lib/kuda', () => ({
  detectNetworkProvider: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('AirtimeDataForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders phone input with placeholder', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const phoneInput = screen.getByPlaceholderText('08012345678');
    expect(phoneInput).toBeInTheDocument();
  });

  it('renders all 4 provider buttons (MTN, Airtel, Glo, 9mobile)', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('MTN')).toBeInTheDocument();
    expect(screen.getByText('Airtel')).toBeInTheDocument();
    expect(screen.getByText('Glo')).toBeInTheDocument();
    expect(screen.getByText('9mobile')).toBeInTheDocument();
  });

  it('renders amount input', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const amountInput = screen.getByPlaceholderText('0.00');
    expect(amountInput).toBeInTheDocument();
  });

  it('shows quick amount buttons (₦100, ₦200, ₦500, ₦1000)', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('₦100')).toBeInTheDocument();
    expect(screen.getByText('₦200')).toBeInTheDocument();
    expect(screen.getByText('₦500')).toBeInTheDocument();
    expect(screen.getByText('₦1000')).toBeInTheDocument();
  });

  it('submit button is disabled when no provider selected', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Pay ₦/i });
    expect(submitButton).toBeDisabled();
  });

  it('calls onSubmit with correct data when form submitted', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    const phoneInput = screen.getByPlaceholderText('08012345678');
    fireEvent.change(phoneInput, { target: { value: '08012345678' } });

    const mtnButton = screen.getByText('MTN');
    fireEvent.click(mtnButton);

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '100' } });

    const submitButton = screen.getByRole('button', { name: /Pay ₦100/i });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      phoneNumber: '08012345678',
      amount: 100,
      networkProvider: 'MTN',
    });
  });

  it('shows "Processing…" when loading is true', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={true}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Processing…')).toBeInTheDocument();
  });

  it('prefills a resumed draft WITHOUT auto-submitting the purchase', () => {
    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        initialDraft={{
          amount: '500',
          networkProvider: 'MTN',
          phoneNumber: '08012345678',
        }}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByPlaceholderText('08012345678')).toHaveValue(
      '08012345678'
    );
    expect(screen.getByLabelText('Amount')).toHaveValue(500);
    expect(screen.getByRole('radio', { name: /MTN/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    // The customer must press Pay themselves — a real-money purchase is never
    // auto-submitted from a restored draft.
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('reports draft changes so an interrupted purchase can be resumed', () => {
    const onDraftChange = vi.fn();

    render(
      <AirtimeDataForm
        type="airtime"
        loading={false}
        onDraftChange={onDraftChange}
        onSubmit={mockOnSubmit}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('08012345678'), {
      target: { value: '08012345678' },
    });
    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '500' },
    });

    expect(onDraftChange).toHaveBeenLastCalledWith({
      amount: '500',
      networkProvider: null,
      phoneNumber: '08012345678',
    });
  });
});
