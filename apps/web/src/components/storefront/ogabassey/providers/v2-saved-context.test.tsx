import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
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
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
});
