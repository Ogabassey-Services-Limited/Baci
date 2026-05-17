import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { SearchAutocomplete } from './search-autocomplete';

// Mock Next.js Image since it's not supported in jsdom
vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: mock implementation requires img
  default: (props: ComponentProps<'img'>) => <img {...props} alt={props.alt} />,
}));

const OriginalResizeObserver = globalThis.ResizeObserver;
const OriginalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {
      // intentional noop
    }
    unobserve() {
      // intentional noop
    }
    disconnect() {
      // intentional noop
    }
  };
});

afterAll(() => {
  globalThis.ResizeObserver = OriginalResizeObserver;
  globalThis.fetch = OriginalFetch;
});

describe('SearchAutocomplete', () => {
  beforeEach(() => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ suggestions: [], popularSearches: [] }),
      })
    ) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('exports a valid component', () => {
    expect(SearchAutocomplete).toBeDefined();
    expect(typeof SearchAutocomplete).toBe('function');
  });

  it('shows clear button when value is present', () => {
    const handleChange = vi.fn();
    render(
      <SearchAutocomplete
        merchantId="test-merchant"
        value="iphone"
        onChange={handleChange}
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('does not show clear button when value is empty', () => {
    const handleChange = vi.fn();
    render(
      <SearchAutocomplete
        merchantId="test-merchant"
        value=""
        onChange={handleChange}
      />
    );

    const clearButton = screen.queryByRole('button', { name: /clear search/i });
    expect(clearButton).not.toBeInTheDocument();
  });

  it('calls onChange with empty string when clear button is clicked', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SearchAutocomplete
        merchantId="test-merchant"
        value="samsung"
        onChange={handleChange}
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('focuses input after clearing', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SearchAutocomplete
        merchantId="test-merchant"
        value="laptop"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('searchbox', { name: /search products/i });
    const clearButton = screen.getByRole('button', { name: /clear search/i });

    // Click clear button
    await user.click(clearButton);

    // Verify input has focus
    expect(input).toHaveFocus();
  });

  it('clears search via keyboard interaction (Tab + Enter)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SearchAutocomplete
        merchantId="test-merchant"
        value="keyboard"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('searchbox', { name: /search products/i });
    const clearButton = screen.getByRole('button', { name: /clear search/i });

    // Focus input first
    await user.click(input);
    expect(input).toHaveFocus();

    // Tab to clear button
    await user.tab();
    expect(clearButton).toHaveFocus();

    // Press Enter to clear
    await user.keyboard('{Enter}');
    expect(handleChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
  });

  it('selects the first autocomplete suggestion when Enter is pressed without a highlighted option', async () => {
    vi.useRealTimers();
    const onSelectProduct = vi.fn();
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({
      json: async () => ({
        suggestions: [
          {
            id: 'product-1',
            name: 'Samsung Galaxy S23',
            slug: 'samsung-galaxy-s23',
            category: 'Smartphones',
            price: 450000,
            image_small: '',
          },
        ],
        popularSearches: [],
      }),
    } as Response);

    render(
      <SearchAutocomplete
        merchantId="merchant-1"
        value="samsung"
        onChange={vi.fn()}
        onSelectProduct={onSelectProduct}
      />
    );

    const input = screen.getByRole('searchbox', { name: /search products/i });
    fireEvent.focus(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(
        screen.getByRole('option', { name: /samsung galaxy s23/i })
      ).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelectProduct).toHaveBeenCalledTimes(1);
    expect(onSelectProduct.mock.calls[0]?.[0]).toContain('samsung-galaxy-s23');
  });

  it('clears loading when the debounced query becomes too short', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(
      () =>
        new Promise(() => {
          // Keep the request pending to simulate a slow network.
        })
    ) as typeof fetch;

    const { rerender } = render(
      <SearchAutocomplete
        merchantId="merchant-1"
        value="iphone"
        onChange={vi.fn()}
      />
    );

    const combobox = screen.getByRole('combobox');
    await act(async () => {
      await Promise.resolve();
    });
    expect(combobox).toHaveAttribute('aria-busy', 'true');

    rerender(
      <SearchAutocomplete
        merchantId="merchant-1"
        value="i"
        onChange={vi.fn()}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(combobox).toHaveAttribute('aria-busy', 'false');
  });
});
