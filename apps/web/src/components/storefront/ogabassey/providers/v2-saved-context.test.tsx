import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { V2SavedProvider, useV2Saved } from './v2-saved-context';

const baseProduct: Product = {
  id: 'product-1',
  name: 'iPhone 17 Pro Max',
  price: '₦2,100,000',
  image: '/iphone.jpg',
  category: 'Smartphones',
  slug: 'iphone-17-pro-max',
  categories: {
    id: 'cat-smartphones',
    name: 'Smartphones',
    slug: 'smartphones',
  },
  rating: 4.9,
  description: 'Flagship phone with top-tier camera and performance.',
  condition: 'New',
};

function SavedConsumer() {
  const { savedItems, toggleSaved } = useV2Saved();

  return (
    <div>
      <span data-testid="saved-count">{savedItems.length}</span>
      <button onClick={() => toggleSaved(baseProduct)} type="button">
        Toggle saved
      </button>
    </div>
  );
}

describe('V2SavedProvider', () => {

  it('returns an inert server fallback when a saved provider is absent during SSR', () => {
    vi.stubGlobal('window', undefined);

    function ServerRenderedConsumer() {
      const saved = useV2Saved();
      return <div>{saved.isSaved('product-1') ? 'saved' : 'not saved'}</div>;
    }

    expect(() => renderToString(<ServerRenderedConsumer />)).not.toThrow();
    expect(renderToString(<ServerRenderedConsumer />)).toContain('not saved');
  });

  it('returns the same inert fallback on the client when a saved provider is absent', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    expect(() => render(<SavedConsumer />)).not.toThrow();
    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle saved' }));
    }).not.toThrow();
    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'V2SavedProvider is missing; using inert saved-items fallback'
    );
  });

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('defers localStorage hydration until idle timeout', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockReturnValue(JSON.stringify([baseProduct]));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(getItemSpy).toHaveBeenCalledOnce();
    expect(screen.getByTestId('saved-count')).toHaveTextContent('1');
  });

  it('hydrates synchronously before the first saved mutation', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify([baseProduct])
    );

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle saved' }));

    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');
  });

  it('ignores malformed saved items loaded from localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify({ id: 'not-an-array' })
    );
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Saved items storage returned invalid data'
    );
  });

  it('ignores incomplete saved products loaded from localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify([{ id: 'product-1' }])
    );
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Saved items storage returned invalid data'
    );
  });

  it('keeps valid saved products when mixed localStorage entries include invalid products', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify([baseProduct, { id: 'missing-required-fields' }])
    );
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId('saved-count')).toHaveTextContent('1');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Saved items storage returned invalid data'
    );
  });

  it('keeps saved products that only have an empty description', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify([{ ...baseProduct, description: '' }])
    );

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId('saved-count')).toHaveTextContent('1');
  });

  it('ignores unparseable saved items loaded from localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      '{"id":"unterminated"'
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to parse saved items',
      expect.any(SyntaxError)
    );
  });

  it('keeps the storefront usable when localStorage reads are blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access blocked', 'SecurityError');
    });
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1200);
      });
    }).not.toThrow();

    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Saved items storage is unavailable',
      expect.any(DOMException)
    );
  });

  it('keeps in-memory saved state when localStorage writes are blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage access blocked', 'SecurityError');
    });
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    render(
      <V2SavedProvider>
        <SavedConsumer />
      </V2SavedProvider>
    );

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1200);
      });
    }).not.toThrow();

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle saved' }));
    }).not.toThrow();

    expect(screen.getByTestId('saved-count')).toHaveTextContent('1');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Saved items storage is unavailable',
      expect.any(DOMException)
    );
  });
});
