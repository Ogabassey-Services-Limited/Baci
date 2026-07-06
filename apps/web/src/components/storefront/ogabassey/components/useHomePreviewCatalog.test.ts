import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { useHomePreviewCatalog } from './useHomePreviewCatalog';

function createTestProduct(index: number): Product {
  return {
    id: `product-${index}`,
    name: `Product ${index}`,
    description: '',
    price: `₦${index}`,
    rawPrice: index,
    condition: 'New',
    image: '',
    images: [],
    manage_stock: true,
    stock: index,
  };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useHomePreviewCatalog', () => {
  it('loads the preview catalog when no real products are provided', async () => {
    // Arrange
    const catalog = [createTestProduct(101), createTestProduct(102)];
    const loadPreviewCatalog = vi.fn().mockResolvedValue({ products: catalog });

    // Act
    const { result } = renderHook(() =>
      useHomePreviewCatalog({ products: [], loadPreviewCatalog })
    );

    // Assert
    expect(result.current).toBeNull();
    await waitFor(() => {
      expect(result.current).toEqual(catalog);
    });
    expect(loadPreviewCatalog).toHaveBeenCalledOnce();
  });

  it('does not load the preview catalog when real products exist', async () => {
    // Arrange
    const loadPreviewCatalog = vi.fn().mockResolvedValue({
      products: [createTestProduct(99)],
    });

    // Act
    const { result } = renderHook(() =>
      useHomePreviewCatalog({
        products: [createTestProduct(1)],
        loadPreviewCatalog,
      })
    );
    await flushMicrotasks();

    // Assert
    expect(loadPreviewCatalog).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('keeps the catalog empty when the preview module fails to load', async () => {
    // Arrange
    const loadPreviewCatalog = vi.fn().mockRejectedValue(new Error('offline'));

    // Act
    const { result } = renderHook(() =>
      useHomePreviewCatalog({ loadPreviewCatalog })
    );
    await flushMicrotasks();

    // Assert: the rejection is swallowed and the hook stays on the empty shell.
    expect(loadPreviewCatalog).toHaveBeenCalledOnce();
    expect(result.current).toBeNull();
  });
});
