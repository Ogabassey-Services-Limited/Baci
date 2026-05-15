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
      <ProductEmbedPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} />
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
  });
});
