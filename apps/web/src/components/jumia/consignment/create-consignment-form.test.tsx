import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateConsignmentForm } from './create-consignment-form';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn((url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('x-csrf-token', 'mock-csrf-token');

    return fetch(url, {
      ...options,
      headers: Object.fromEntries(headers.entries()),
      credentials: 'include',
    });
  }),
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeText: (t: string) => t,
}));

vi.mock('@/components/themed/themed-button', () => ({
  ThemedButton: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  }) => (
    <button type="submit" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/themed/themed-input', () => ({
  ThemedInput: ({
    ref,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    ref?: React.Ref<HTMLInputElement>;
  }) => <input ref={ref} {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
    variant?: string;
    size?: string;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h3>{children}</h3>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement> & {
    children: React.ReactNode;
    // biome-ignore lint/a11y/noLabelWithoutControl: Test mock for Label component
  }) => <label {...props}>{children}</label>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

/** Returns a future date in YYYY-MM-DD format */
function getFutureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('CreateConsignmentForm', () => {
  const defaultProps = {
    integrationId: 'int-1',
    businessClientCode: 'jumia_ng',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders form fields', () => {
    render(<CreateConsignmentForm {...defaultProps} />);

    expect(screen.getByText('Create Consignment Order')).toBeInTheDocument();
    expect(screen.getByLabelText('Shipping Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Comment (Optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('SKU for product row 1')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Quantity for product row 1')
    ).toBeInTheDocument();
    expect(screen.getByText('Send to Jumia Warehouse')).toBeInTheDocument();
  });

  it('adds a product row when Add Product is clicked', () => {
    render(<CreateConsignmentForm {...defaultProps} />);

    expect(
      screen.queryByLabelText('SKU for product row 2')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Add Product'));

    expect(screen.getByLabelText('SKU for product row 2')).toBeInTheDocument();
  });

  it('removes a product row when remove button is clicked', () => {
    render(<CreateConsignmentForm {...defaultProps} />);

    // Add a second row first
    fireEvent.click(screen.getByText('Add Product'));
    expect(screen.getByLabelText('SKU for product row 2')).toBeInTheDocument();

    // Remove second row
    fireEvent.click(screen.getByLabelText('Remove product row 2'));
    expect(
      screen.queryByLabelText('SKU for product row 2')
    ).not.toBeInTheDocument();
  });

  it('shows validation error when shipping date is missing', async () => {
    render(<CreateConsignmentForm {...defaultProps} />);

    // Fill SKU and quantity but no date
    fireEvent.change(screen.getByLabelText('SKU for product row 1'), {
      target: { value: 'SKU-1' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for product row 1'), {
      target: { value: '10' },
    });

    fireEvent.submit(screen.getByText('Send to Jumia Warehouse'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Error',
          description: 'Shipping date is required.',
        })
      );
    });
  });

  it('shows validation error when SKU is empty', async () => {
    render(<CreateConsignmentForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Shipping Date'), {
      target: { value: getFutureDate() },
    });

    // Leave SKU empty, only set quantity
    fireEvent.change(screen.getByLabelText('Quantity for product row 1'), {
      target: { value: '10' },
    });

    fireEvent.submit(screen.getByText('Send to Jumia Warehouse'));

    // Row has quantity but no SKU, so the Zod schema rejects it
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Error',
          description: 'Row 1: SKU is required',
        })
      );
    });
  });

  it('submits successfully with valid data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ purchaseOrderNumber: 'PO-2026-001' }),
      })
    );

    render(<CreateConsignmentForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Shipping Date'), {
      target: { value: getFutureDate() },
    });
    fireEvent.change(screen.getByLabelText('SKU for product row 1'), {
      target: { value: 'SKU-1' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for product row 1'), {
      target: { value: '5' },
    });

    fireEvent.submit(screen.getByText('Send to Jumia Warehouse'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/marketplace/jumia/consignment',
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      );
    });

    // Verify fetch headers and body
    const fetchMock = vi.mocked(fetch);
    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-csrf-token']).toBe('mock-csrf-token');
    const body = JSON.parse(options?.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        integrationId: 'int-1',
        businessClientCode: 'jumia_ng',
        products: expect.arrayContaining([
          expect.objectContaining({ sku: 'SKU-1', quantity: 5 }),
        ]),
      })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Consignment Created',
          description: 'Purchase Order: PO-2026-001',
        })
      );
    });
  });

  it('shows destructive toast when API returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Warehouse full' }),
      })
    );

    render(<CreateConsignmentForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Shipping Date'), {
      target: { value: getFutureDate() },
    });
    fireEvent.change(screen.getByLabelText('SKU for product row 1'), {
      target: { value: 'SKU-1' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for product row 1'), {
      target: { value: '5' },
    });

    fireEvent.submit(screen.getByText('Send to Jumia Warehouse'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });
  });

  it('shows destructive toast when fetch rejects with a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    );

    render(<CreateConsignmentForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Shipping Date'), {
      target: { value: getFutureDate() },
    });
    fireEvent.change(screen.getByLabelText('SKU for product row 1'), {
      target: { value: 'SKU-1' },
    });
    fireEvent.change(screen.getByLabelText('Quantity for product row 1'), {
      target: { value: '5' },
    });

    fireEvent.submit(screen.getByText('Send to Jumia Warehouse'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });
  });
});
