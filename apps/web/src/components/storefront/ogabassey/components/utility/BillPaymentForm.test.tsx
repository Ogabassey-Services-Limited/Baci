import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

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

interface MockFetchResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  statusText?: string;
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('BillPaymentForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockFetch.mockReset();
    mockFetchWithCsrf.mockReset();
    mockFetchWithCsrf.mockImplementation(mockFetch);
  });

  it('shows loading state initially ("Loading providers…")', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Loading providers…')).toBeInTheDocument();
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
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/vtu/billers?type=cable_tv&includeMonnify=true',
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(mockFetch.mock.calls[0]?.[1]).not.toHaveProperty('cache');
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
    const user = userEvent.setup();
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

    await user.click(screen.getByText('Eko Electricity'));
    await waitFor(() => {
      expect(screen.getByText('Meter Type')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Enter meter number')).toBeNull();
    });

    await user.click(screen.getByText('Prepaid'));
    await waitFor(() => {
      expect(screen.getByText('Residential')).toBeInTheDocument();
      expect(screen.getByText('Commercial')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Commercial'));
    const meterInput = await screen.findByPlaceholderText('Enter meter number');
    await user.type(meterInput, '1234567890');
    await user.click(screen.getByRole('button', { name: /Verify/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/vtu/verify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'kuda',
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
            provider: 'kuda',
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

  it('shows verification errors from non-OK responses without unlocking payment', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
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
        ok: false,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            error: 'Invalid smart card number',
          }),
      });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    fireEvent.click(await screen.findByText('DStv'));
    fireEvent.change(screen.getByPlaceholderText('Enter smart card number'), {
      target: { value: '1234567890' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify/i }));

    expect(
      await screen.findByText('Invalid smart card number')
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('ignores stale verification responses after the customer identifier changes', async () => {
    const firstVerification = createDeferred<MockFetchResponse>();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
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
      .mockReturnValueOnce(firstVerification.promise)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            verified: true,
            customerName: 'Fresh Customer',
          }),
      });

    render(
      <BillPaymentForm
        type="tv"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    fireEvent.click(await screen.findByText('DStv'));
    const customerIdInput = screen.getByPlaceholderText(
      'Enter smart card number'
    );
    fireEvent.change(customerIdInput, {
      target: { value: '1111111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    fireEvent.change(customerIdInput, {
      target: { value: '2222222222' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify/i }));

    expect(await screen.findByText('Fresh Customer')).toBeInTheDocument();

    await act(async () => {
      firstVerification.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            verified: true,
            customerName: 'Stale Customer',
          }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Fresh Customer')).toBeInTheDocument();
    expect(screen.queryByText('Stale Customer')).not.toBeInTheDocument();
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
      provider: 'kuda',
      customerIdentifier: '1234567890',
      billerName: 'DStv',
      type: 'cable_tv',
    });
  });

  it('verifies and submits Monnify biller fields end to end', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            billers: [
              {
                billerId: 'IKEDC',
                billerName: 'Ikeja Electric',
                billerType: 'electricity',
                categoryId: 'UTILITY_PAYMENT',
                categoryName: 'electricity',
                provider: 'monnify',
                billerCode: 'IKEDC',
                billItems: [
                  {
                    itemCode: 'IKEDC-PREPAID',
                    itemName: 'Prepaid',
                    amount: 0,
                    itemCurrencySymbol: 'NGN',
                    isAmountFixed: false,
                    itemFee: 0,
                    provider: 'monnify',
                    billerCode: 'IKEDC',
                    productCode: 'IKEDC-PREPAID',
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
            customerName: 'Jane Meter',
            validationReference: 'VAL-MON-123',
            requireValidationRef: true,
          }),
      });

    render(
      <BillPaymentForm
        type="power"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(await screen.findByText('Ikeja Electric'));
    const meterInput = await screen.findByPlaceholderText('Enter meter number');
    await user.type(meterInput, '1234567890');
    await user.click(screen.getByRole('button', { name: /Verify/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/vtu/verify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'monnify',
            billerCode: 'IKEDC',
            productCode: 'IKEDC-PREPAID',
            customerIdentifier: '1234567890',
          }),
        })
      );
    });

    await screen.findByText('Customer verified');
    await user.type(screen.getByPlaceholderText('0.00'), '5000');
    await user.click(screen.getByRole('button', { name: /Pay ₦5,000/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      amount: 5000,
      billItemIdentifier: 'IKEDC-PREPAID',
      billerCode: 'IKEDC',
      customerIdentifier: '1234567890',
      billerName: 'Ikeja Electric - Prepaid',
      productCode: 'IKEDC-PREPAID',
      provider: 'monnify',
      requireValidationRef: true,
      type: 'electricity',
      validationReference: 'VAL-MON-123',
    });
  });

  it('threads the verified meter address into the checkout payload', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            billers: [
              {
                billerId: 'IKEDC',
                billerName: 'Ikeja Electric',
                billerType: 'electricity',
                categoryId: 'UTILITY_PAYMENT',
                categoryName: 'electricity',
                provider: 'monnify',
                billerCode: 'IKEDC',
                billItems: [
                  {
                    itemCode: 'IKEDC-PREPAID',
                    itemName: 'Prepaid',
                    amount: 0,
                    itemCurrencySymbol: 'NGN',
                    isAmountFixed: false,
                    itemFee: 0,
                    provider: 'monnify',
                    billerCode: 'IKEDC',
                    productCode: 'IKEDC-PREPAID',
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
            customerName: 'Jane Meter',
            address: '12 Marina Road, Lagos',
            validationReference: 'VAL-MON-ADDR',
            requireValidationRef: true,
          }),
      });

    render(
      <BillPaymentForm type="power" loading={false} onSubmit={mockOnSubmit} />
    );

    await user.click(await screen.findByText('Ikeja Electric'));
    const meterInput = await screen.findByPlaceholderText('Enter meter number');
    await user.type(meterInput, '1234567890');
    await user.click(screen.getByRole('button', { name: /Verify/i }));

    await screen.findByText('Customer verified');
    await user.type(screen.getByPlaceholderText('0.00'), '5000');
    await user.click(screen.getByRole('button', { name: /Pay ₦5,000/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        customerAddress: '12 Marina Road, Lagos',
      })
    );
  });

  it('verifies and submits folded Kuda electricity items with Monnify fulfillment codes', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            billers: [
              {
                billerId: 'IKEDC-KUDA',
                billerName: 'Ikeja Electric',
                billerType: 'electricity',
                categoryId: 'UTILITY_PAYMENT',
                categoryName: 'electricity',
                provider: 'kuda',
                billItems: [
                  {
                    itemCode: 'KUD-ELE-IKEDC-PREPAID',
                    itemName: 'Prepaid',
                    amount: 0,
                    itemCurrencySymbol: 'NGN',
                    isAmountFixed: false,
                    itemFee: 0,
                    provider: 'kuda',
                    monnifyBillerCode: 'IKEDC',
                    monnifyProductCode: 'IKEDC_PREPAID',
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
            customerName: 'Jane Meter',
            validationReference: 'VAL-FOLDED-123',
            requireValidationRef: true,
          }),
      });

    render(
      <BillPaymentForm
        type="power"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(await screen.findByText('Ikeja Electric'));
    await user.type(
      await screen.findByPlaceholderText('Enter meter number'),
      '1234567890'
    );
    await user.click(screen.getByRole('button', { name: /Verify/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/vtu/verify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'monnify',
            billerCode: 'IKEDC',
            productCode: 'IKEDC_PREPAID',
            customerIdentifier: '1234567890',
          }),
        })
      );
    });

    await screen.findByText('Customer verified');
    await user.type(screen.getByPlaceholderText('0.00'), '5000');
    await user.click(screen.getByRole('button', { name: /Pay ₦5,000/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      amount: 5000,
      billItemIdentifier: 'KUD-ELE-IKEDC-PREPAID',
      billerCode: 'IKEDC',
      customerIdentifier: '1234567890',
      billerName: 'Ikeja Electric - Prepaid',
      productCode: 'IKEDC_PREPAID',
      provider: 'monnify',
      requireValidationRef: true,
      type: 'electricity',
      validationReference: 'VAL-FOLDED-123',
    });
  });

  it('shows feedback instead of silently returning when Monnify validation reference is missing', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            billers: [
              {
                billerId: 'IKEDC',
                billerName: 'Ikeja Electric',
                billerType: 'electricity',
                categoryId: 'UTILITY_PAYMENT',
                categoryName: 'electricity',
                provider: 'monnify',
                billerCode: 'IKEDC',
                billItems: [
                  {
                    itemCode: 'IKEDC-PREPAID',
                    itemName: 'Prepaid',
                    amount: 0,
                    itemCurrencySymbol: 'NGN',
                    isAmountFixed: false,
                    itemFee: 0,
                    provider: 'monnify',
                    billerCode: 'IKEDC',
                    productCode: 'IKEDC-PREPAID',
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
            customerName: 'Jane Meter',
            requireValidationRef: true,
          }),
      });

    render(
      <BillPaymentForm
        type="power"
        loading={false}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(await screen.findByText('Ikeja Electric'));
    await user.type(
      await screen.findByPlaceholderText('Enter meter number'),
      '1234567890'
    );
    await user.click(screen.getByRole('button', { name: /Verify/i }));

    await screen.findByText('Customer verified');
    await user.type(screen.getByPlaceholderText('0.00'), '5000');
    await user.click(screen.getByRole('button', { name: /Pay ₦5,000/i }));

    expect(mockOnSubmit).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Please verify this bill again before paying.')
    ).toBeInTheDocument();
  });
});
