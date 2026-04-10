import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JumiaProductOverrides } from './jumia-product-overrides';

const savedFetch = global.fetch;

afterEach(() => {
  global.fetch = savedFetch;
});

// --- Mocks ---

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
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

vi.mock('@/components/products/jumia-price-form', () => ({
  JumiaPriceForm: () => <div data-testid="jumia-price-form">PriceForm</div>,
}));

vi.mock('@/components/products/jumia-sync-settings', () => ({
  JumiaSyncSettings: () => (
    <div data-testid="jumia-sync-settings">SyncSettings</div>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ fill: _fill, ...props }: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: next/image test mock
    // biome-ignore lint/a11y/useAltText: test mock
    <img {...props} />
  ),
}));

vi.mock('@/components/themed/themed-badge', () => ({
  ThemedBadge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/components/themed/themed-button', () => ({
  ThemedButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
}));

vi.mock('@/components/themed/themed-card', () => ({
  ThemedCard: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  CardContent: ({
    children,
    role,
  }: {
    children: React.ReactNode;
    role?: string;
  }) => <div role={role}>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: { checked?: boolean }) => (
    <input
      type="checkbox"
      role="switch"
      aria-checked={props.checked}
      checked={props.checked}
      readOnly
    />
  ),
}));

// Mock response — includes API-returned columns plus fields the component
// reads via optional chaining for the overrides form.
const MAPPING_RESPONSE = {
  mapping: {
    id: 'map-1',
    product_id: 'prod-1',
    jumia_sku: 'JM-SKU-999',
    jumia_product_url: 'https://jumia.com/p/123',
    sync_status: 'synced' as const,
    last_synced_at: null,
    created_at: '2025-01-01T00:00:00Z',
    jumia_price: 5000,
    jumia_sale_price: null,
    jumia_sale_start: null,
    jumia_sale_end: null,
    is_active: true,
    sync_inventory: true,
    sync_price: false,
  },
};

const defaultProps = {
  productId: 'prod-1',
  basePrice: 4500,
  integrationId: 'int-1',
};

beforeEach(() => {
  vi.restoreAllMocks();
  toastMock.mockClear();
});

describe('JumiaProductOverrides', () => {
  it('shows loader while fetching', () => {
    // Arrange: fetch never resolves
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((_resolve) => {
          /* never resolves */
        })
    );

    // Act
    render(<JumiaProductOverrides {...defaultProps} />);

    // Assert
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('returns null when no mapping exists', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    // Act
    const { container } = render(<JumiaProductOverrides {...defaultProps} />);

    // Assert
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('fetches the mapping with correct query params', async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MAPPING_RESPONSE),
    });
    global.fetch = fetchMock;

    // Act
    render(<JumiaProductOverrides {...defaultProps} />);

    // Assert
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/marketplace/jumia/products?productId=prod-1&integrationId=int-1'
      );
    });
  });

  it('renders mapping data with SKU badge and active toggle', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MAPPING_RESPONSE),
    });

    // Act
    render(<JumiaProductOverrides {...defaultProps} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/SKU: JM-SKU-999/)).toBeInTheDocument();
    });

    const logo = screen.getByRole('img', { name: 'Jumia' }) as HTMLImageElement;
    expect(logo.getAttribute('src')).toBe('/jumia-logo.png');

    expect(screen.getByRole('switch')).toBeChecked();
    expect(
      screen.getByRole('heading', { name: 'Jumia Marketplace' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save Jumia Settings' })
    ).toBeInTheDocument();
  });

  it('calls update API with correct payload on save', async () => {
    // Arrange
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MAPPING_RESPONSE),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    global.fetch = fetchMock;

    render(<JumiaProductOverrides {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Save Jumia Settings' })
      ).toBeInTheDocument();
    });

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Save Jumia Settings' })
    );

    // Assert
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/marketplace/jumia/products/update',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'mock-csrf-token',
          }),
        })
      );
    });

    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.productId).toBe('prod-1');
    expect(body.integrationId).toBe('int-1');
    expect(body.overrides.jumia_price).toBe(5000);
    expect(body.overrides.is_active).toBe(true);
    expect(body.overrides.sync_inventory).toBe(true);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Jumia Overrides Saved' })
    );
  });

  it('shows error toast when save fails', async () => {
    // Arrange
    const user = userEvent.setup();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MAPPING_RESPONSE),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

    render(<JumiaProductOverrides {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Save Jumia Settings' })
      ).toBeInTheDocument();
    });

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Save Jumia Settings' })
    );

    // Assert
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Update Failed',
          description: 'Server error',
          variant: 'destructive',
        })
      );
    });
  });

  it('renders nothing when fetch fails with a network error', async () => {
    // Arrange
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    // Act
    const { container } = render(<JumiaProductOverrides {...defaultProps} />);

    // Assert
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });
});
