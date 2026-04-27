import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BillPaymentForm } from './BillPaymentForm';

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BillPaymentForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockFetch.mockClear();
  });

  it('shows loading state initially ("Loading providers...")', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Loading providers...')).toBeInTheDocument();
  });

  it('renders billers after fetch completes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        billers: [
          {
            billerId: 'DSTV',
            billerName: 'DStv',
            billerType: 'cable',
            categoryId: '1',
            categoryName: 'CableTv',
          },
        ],
      }),
    });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DStv')).toBeInTheDocument();
    });
  });

  it('shows provider label based on type (TV Subscription, Electricity, Betting Top-up)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ billers: [] }),
    });

    const { rerender } = render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/TV Subscription/i)).toBeInTheDocument();
    });

    rerender(
      <BillPaymentForm
        type="power"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Electricity/i)).toBeInTheDocument();
    });

    rerender(
      <BillPaymentForm
        type="betting"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Betting Top-up/i)).toBeInTheDocument();
    });
  });

  it('shows customer ID input after selecting a biller', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        billers: [
          {
            billerId: 'DSTV',
            billerName: 'DStv',
            billerType: 'cable',
            categoryId: '1',
            categoryName: 'CableTv',
          },
        ],
      }),
    });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DStv')).toBeInTheDocument();
    });

    const billerButton = screen.getByText('DStv');
    fireEvent.click(billerButton);

    expect(screen.getByPlaceholderText('Enter smart card number')).toBeInTheDocument();
  });

  it('shows "Smart Card Number" label for tv type', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        billers: [
          {
            billerId: 'DSTV',
            billerName: 'DStv',
            billerType: 'cable',
            categoryId: '1',
            categoryName: 'CableTv',
          },
        ],
      }),
    });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DStv')).toBeInTheDocument();
    });

    const billerButton = screen.getByText('DStv');
    fireEvent.click(billerButton);

    expect(screen.getByText('Smart Card Number')).toBeInTheDocument();
  });

  it('shows "Meter Number" label for power type', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        billers: [
          {
            billerId: 'EKEDC',
            billerName: 'Eko Electricity',
            billerType: 'electricity',
            categoryId: '2',
            categoryName: 'Power',
          },
        ],
      }),
    });

    render(
      <BillPaymentForm
        type="power"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Eko Electricity')).toBeInTheDocument();
    });

    const billerButton = screen.getByText('Eko Electricity');
    fireEvent.click(billerButton);

    expect(screen.getByText('Meter Number')).toBeInTheDocument();
  });

  it('shows nested bill item submenus and verifies the selected leaf item', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            billers: [
              {
                billerId: 'EKEDC',
                billerName: 'Eko Electricity',
                billerType: 'electricity',
                categoryId: '2',
                categoryName: 'Power',
                billItems: [
                  {
                    itemCode: 'prepaid',
                    itemName: 'Prepaid',
                    amount: 0,
                    itemCurrencySymbol: 'NGN',
                    isAmountFixed: false,
                    itemFee: 0,
                    billItems: [
                      {
                        itemCode: 'residential',
                        itemName: 'Residential',
                        amount: 0,
                        itemCurrencySymbol: 'NGN',
                        isAmountFixed: false,
                        itemFee: 0,
                      },
                      {
                        itemCode: 'commercial',
                        itemName: 'Commercial',
                        amount: 0,
                        itemCurrencySymbol: 'NGN',
                        isAmountFixed: false,
                        itemFee: 0,
                      },
                    ],
                  },
                ],
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            verified: true,
            customerName: 'John Doe',
          }),
      });

    render(
      <BillPaymentForm
        type="power"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Eko Electricity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Eko Electricity'));
    await waitFor(() => {
      expect(screen.getByText('Meter Type')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Enter meter number')).toBeNull();
    });

    fireEvent.click(screen.getByText('Prepaid'));
    await waitFor(() => {
      expect(screen.getByText('Residential')).toBeInTheDocument();
      expect(screen.getByText('Commercial')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Commercial'));
    fireEvent.change(screen.getByPlaceholderText('Enter meter number'), {
      target: { value: '1234567890' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/vtu/verify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billItemIdentifier: 'commercial',
            customerIdentifier: '1234567890',
          }),
        })
      );
    });
  });

  it('Verify button calls /api/vtu/verify', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          billers: [
            {
              billerId: 'DSTV',
              billerName: 'DStv',
              billerType: 'cable',
              categoryId: '1',
              categoryName: 'CableTv',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verified: true,
          customerName: 'John Doe',
        }),
      });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DStv')).toBeInTheDocument();
    });

    const billerButton = screen.getByText('DStv');
    fireEvent.click(billerButton);

    const customerIdInput = screen.getByPlaceholderText('Enter smart card number');
    fireEvent.change(customerIdInput, { target: { value: '1234567890' } });

    const verifyButton = screen.getByRole('button', { name: /Verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/vtu/verify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billItemIdentifier: 'DSTV',
            customerIdentifier: '1234567890',
          }),
        })
      );
    });
  });

  it('shows VerificationBadge after verification', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          billers: [
            {
              billerId: 'DSTV',
              billerName: 'DStv',
              billerType: 'cable',
              categoryId: '1',
              categoryName: 'CableTv',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verified: true,
          customerName: 'John Doe',
        }),
      });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DStv')).toBeInTheDocument();
    });

    const billerButton = screen.getByText('DStv');
    fireEvent.click(billerButton);

    const customerIdInput = screen.getByPlaceholderText('Enter smart card number');
    fireEvent.change(customerIdInput, { target: { value: '1234567890' } });

    const verifyButton = screen.getByRole('button', { name: /Verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Customer verified')).toBeInTheDocument();
    });
  });

  it('submit button appears after successful verification', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          billers: [
            {
              billerId: 'DSTV',
              billerName: 'DStv',
              billerType: 'cable',
              categoryId: '1',
              categoryName: 'CableTv',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verified: true,
          customerName: 'John Doe',
        }),
      });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DStv')).toBeInTheDocument();
    });

    const billerButton = screen.getByText('DStv');
    fireEvent.click(billerButton);

    const customerIdInput = screen.getByPlaceholderText('Enter smart card number');
    fireEvent.change(customerIdInput, { target: { value: '1234567890' } });

    const verifyButton = screen.getByRole('button', { name: /Verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Customer verified')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('0.00');
    expect(amountInput).toBeInTheDocument();

    fireEvent.change(amountInput, { target: { value: '5000' } });

    const submitButton = screen.getByRole('button', { name: /Pay ₦5,000/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('calls onSubmit with correct payload including type mapping (tv → cable_tv)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          billers: [
            {
              billerId: 'DSTV',
              billerName: 'DStv',
              billerType: 'cable',
              categoryId: '1',
              categoryName: 'CableTv',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verified: true,
          customerName: 'John Doe',
        }),
      });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('DStv')).toBeInTheDocument();
    });

    const billerButton = screen.getByText('DStv');
    fireEvent.click(billerButton);

    const customerIdInput = screen.getByPlaceholderText('Enter smart card number');
    fireEvent.change(customerIdInput, { target: { value: '1234567890' } });

    const verifyButton = screen.getByRole('button', { name: /Verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText('Customer verified')).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '5000' } });

    const submitButton = screen.getByRole('button', { name: /Pay ₦5,000/i });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      amount: 5000,
      billItemIdentifier: 'DSTV',
      customerIdentifier: '1234567890',
      billerName: 'DStv',
      type: 'cable_tv',
    });
  });
});
