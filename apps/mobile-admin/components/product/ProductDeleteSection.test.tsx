import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductDeleteSection } from './ProductDeleteSection';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  lastOnConfirmDelete: null as null | (() => Promise<void>),
  mutateAsync: vi.fn(),
  useArchiveProduct: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ back: mocks.back }),
}));

vi.mock('@/hooks/useArchiveProduct', () => ({
  useArchiveProduct: () => mocks.useArchiveProduct(),
}));

vi.mock('./ProductDeleteCard', () => ({
  ProductDeleteCard: ({
    disabled,
    onConfirmDelete,
    productName,
  }: {
    disabled: boolean;
    onConfirmDelete: () => Promise<void>;
    productName: string;
  }) => {
    mocks.lastOnConfirmDelete = onConfirmDelete;
    return (
      <button disabled={disabled} onClick={onConfirmDelete} type="button">
        {`delete ${productName}`}
      </button>
    );
  },
}));

vi.mock('react-native', () => ({
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = {
  border: '#334155',
  card: '#111827',
  error: '#ef4444',
  errorLight: '#fee2e2',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
} as unknown as ThemeColors;

describe('ProductDeleteSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lastOnConfirmDelete = null;
    mocks.useArchiveProduct.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.mutateAsync,
    });
    mocks.mutateAsync.mockResolvedValue({ success: true });
  });

  it('archives through the permission-checked endpoint and returns to the list', async () => {
    render(
      <ProductDeleteSection
        colors={colors}
        productId="product-1"
        productName="Phone Ultra"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete Phone Ultra' }));

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        productId: 'product-1',
      });
    });
    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it('does not navigate back when the archive request fails', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('Network error'));

    render(
      <ProductDeleteSection
        colors={colors}
        productId="product-1"
        productName="Phone Ultra"
      />
    );

    await expect(mocks.lastOnConfirmDelete?.()).rejects.toThrow(
      'Network error'
    );
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      productId: 'product-1',
    });
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it('disables delete while the archive request is pending', () => {
    mocks.useArchiveProduct.mockReturnValue({
      isPending: true,
      mutateAsync: mocks.mutateAsync,
    });

    render(
      <ProductDeleteSection
        colors={colors}
        productId="product-1"
        productName="Phone Ultra"
      />
    );

    expect(
      screen.getByRole('button', { name: 'delete Phone Ultra' })
    ).toBeDisabled();
  });
});
