import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductEmbedPicker } from './product-embed';

function mockFetch() {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: true,
    json: async () => ({ products: [] }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ProductEmbedPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports a valid component', () => {
    expect(ProductEmbedPicker).toBeDefined();
    expect(typeof ProductEmbedPicker).toBe('function');
  });

  it('debounces search-driven fetches into a single trailing request', async () => {
    // Arrange
    const fetchMock = mockFetch();
    render(
      <ProductEmbedPicker
        merchantId="merchant-1"
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    // Initial open triggers one fetch with the empty debounced query.
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Act: three rapid keystrokes within the 300ms debounce window.
    const input = screen.getByPlaceholderText('Search products...');
    fireEvent.change(input, { target: { value: 'p' } });
    fireEvent.change(input, { target: { value: 'ph' } });
    fireEvent.change(input, { target: { value: 'pho' } });

    // Assert: still only the initial fetch -- no per-keystroke requests.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Act: cross the debounce boundary.
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    // Assert: exactly one additional fetch, carrying only the final query.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const lastUrl = String(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(lastUrl).toContain('search=pho');
    expect(lastUrl).toContain('merchantId=merchant-1');
  });

  it('does not load products without a selected merchant', async () => {
    const fetchMock = mockFetch();

    render(
      <ProductEmbedPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} />
    );

    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('Select a merchant before embedding products.')
    ).toBeInTheDocument();
  });

  it('shows a distinct error state when product loading fails', async () => {
    const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductEmbedPicker
        merchantId="merchant-1"
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await flush();

    expect(
      screen.getByText('Failed to load products. Please try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No products found')).not.toBeInTheDocument();
  });

  it('does not show an error for an aborted stale product request', async () => {
    let rejectFirst: ((reason?: unknown) => void) | undefined;
    let firstSignal: AbortSignal | undefined;

    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, options?: RequestInit) => {
        firstSignal = options?.signal as AbortSignal | undefined;
        return new Promise((_resolve, reject) => {
          rejectFirst = reject;
        });
      })
      .mockImplementation((_url: string, options?: RequestInit) => {
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve({
          ok: true,
          json: async () => ({ products: [] }),
        });
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductEmbedPicker
        merchantId="merchant-1"
        open={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await flush();
    fireEvent.change(screen.getByPlaceholderText('Search products...'), {
      target: { value: 'phone' },
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(firstSignal?.aborted).toBe(true);
    rejectFirst?.(new DOMException('Aborted', 'AbortError'));
    await flush();

    expect(
      screen.queryByText('Failed to load products. Please try again.')
    ).not.toBeInTheDocument();
  });
});
