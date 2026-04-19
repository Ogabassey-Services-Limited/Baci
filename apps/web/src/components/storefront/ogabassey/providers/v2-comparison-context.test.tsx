import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import {
  V2ComparisonProvider,
  useV2Comparison,
} from './v2-comparison-context';

const baseProduct: Product = {
  id: 'product-1',
  name: 'PlayStation 5',
  price: '₦1,350,000',
  image: '/ps5.jpg',
  category: 'Gaming',
  slug: 'playstation-5',
  categories: {
    id: 'cat-gaming',
    name: 'Gaming',
    slug: 'gaming',
  },
  rating: 4.8,
  description: 'Gaming console bundle.',
  condition: 'New',
};

function ComparisonConsumer() {
  const { addToCompare, compareItems } = useV2Comparison();

  return (
    <div>
      <span data-testid="compare-count">{compareItems.length}</span>
      <button onClick={() => addToCompare(baseProduct)} type="button">
        Add to compare
      </button>
    </div>
  );
}

describe('V2ComparisonProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('defers comparison storage hydration until idle timeout', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockReturnValue(JSON.stringify([baseProduct]));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(
      <V2ComparisonProvider>
        <ComparisonConsumer />
      </V2ComparisonProvider>
    );

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('compare-count')).toHaveTextContent('0');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(getItemSpy).toHaveBeenCalledOnce();
    expect(screen.getByTestId('compare-count')).toHaveTextContent('1');
  });

  it('hydrates synchronously before the first comparison mutation', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify([baseProduct])
    );

    const nextProduct: Product = {
      ...baseProduct,
      id: 'product-2',
      name: 'Xbox Series X',
    };

    function MutatingConsumer() {
      const { addToCompare, compareItems } = useV2Comparison();

      return (
        <div>
          <span data-testid="compare-count">{compareItems.length}</span>
          <button onClick={() => addToCompare(nextProduct)} type="button">
            Add to compare
          </button>
        </div>
      );
    }

    render(
      <V2ComparisonProvider>
        <MutatingConsumer />
      </V2ComparisonProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to compare' }));

    expect(screen.getByTestId('compare-count')).toHaveTextContent('2');
  });
});
