import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SearchAutocomplete } from './search-autocomplete';

// Mock Next.js Image since it's not supported in jsdom
vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: mock implementation requires img
  default: (props: ComponentProps<'img'>) => <img {...props} alt={props.alt} />,
}));

const OriginalResizeObserver = globalThis.ResizeObserver;

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
});

describe('SearchAutocomplete', () => {
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
});
