import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportToJumiaDialog } from '@/components/products/jumia/export-dialog';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/csrf', () => ({
  getClientCsrfToken: () => 'mock-csrf-token',
}));

vi.mock('@/lib/sanitize-core', () => ({
  sanitizeText: (t: string) => t,
  stripHtmlTags: (t: string) => t,
}));

vi.mock('./brand-selector', () => ({
  JumiaBrandSelector: ({
    onSelect,
  }: {
    merchantId: string;
    value: unknown;
    onSelect: (b: { code: number; name: string }) => void;
  }) => (
    <button
      type="button"
      data-testid="brand-selector"
      onClick={() => onSelect({ code: 99, name: 'TestBrand' })}
    >
      Select Brand
    </button>
  ),
}));

vi.mock('./category-selector', () => ({
  JumiaCategorySelector: ({
    onSelect,
  }: {
    merchantId: string;
    value?: number;
    onSelect: (code: number) => void;
  }) => (
    <button
      type="button"
      data-testid="category-selector"
      onClick={() => onSelect(42)}
    >
      Select Category
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const mockProduct = {
  id: 'prod-1',
  sku: 'SKU-001',
  name: 'Test Product',
  description: 'A test product',
  price: 5000,
  images: ['https://img.test/1.jpg'],
};

const defaultProps = {
  product: mockProduct,
  merchantId: 'merchant-1',
  integrationId: 'int-1',
};

describe('ExportToJumiaDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders dialog content when open', () => {
    render(
      <ExportToJumiaDialog {...defaultProps} open onOpenChange={vi.fn()} />
    );

    expect(
      screen.getByText(/Export.*Test Product.*to Jumia/)
    ).toBeInTheDocument();
    expect(screen.getByText('Jumia Category (Required)')).toBeInTheDocument();
    expect(screen.getByText('Jumia Brand (Required)')).toBeInTheDocument();
  });

  it('shows "Selection Required" toast when category/brand missing', () => {
    render(
      <ExportToJumiaDialog {...defaultProps} open onOpenChange={vi.fn()} />
    );

    fireEvent.click(screen.getByText('Export Product'));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Selection Required',
        description: 'Please select a Category and Brand',
        variant: 'destructive',
      })
    );
  });

  it('successful POST shows "Export Started" toast with feedId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, feedId: 'FEED-123' }),
      })
    );

    const onOpenChange = vi.fn();
    render(
      <ExportToJumiaDialog {...defaultProps} open onOpenChange={onOpenChange} />
    );

    // Select category and brand
    fireEvent.click(screen.getByTestId('category-selector'));
    fireEvent.click(screen.getByTestId('brand-selector'));

    // Export
    fireEvent.click(screen.getByText('Export Product'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Export Started',
          description: 'Feed ID: FEED-123',
        })
      );
    });

    // Dialog should close after successful export
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Verify fetch was called with the correct URL, method, headers, and body
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/marketplace/jumia/products/export');
    expect(options?.method).toBe('POST');
    expect((options?.headers as Record<string, string>)?.['Content-Type']).toBe(
      'application/json'
    );
    const body = JSON.parse(options?.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        integrationId: 'int-1',
        name: 'Test Product',
        category: expect.objectContaining({ code: 42 }),
        brand: expect.objectContaining({ code: 99, name: 'TestBrand' }),
      })
    );
  });

  it('shows "Export Failed" toast when fetch returns non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server blew up' }),
      })
    );

    render(
      <ExportToJumiaDialog {...defaultProps} open onOpenChange={vi.fn()} />
    );

    fireEvent.click(screen.getByTestId('category-selector'));
    fireEvent.click(screen.getByTestId('brand-selector'));
    fireEvent.click(screen.getByText('Export Product'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Export Failed',
          description: 'Server blew up',
          variant: 'destructive',
        })
      );
    });
  });
});
