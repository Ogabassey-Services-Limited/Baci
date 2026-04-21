import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ProductEditFormData } from '@/components/product/product-edit.types';
import type { ThemeColors } from '@/constants/theme';
import { ProductHasVariantsToggleCard } from './ProductHasVariantsToggleCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Platform: { OS: 'android' },
    Switch: ({
      onValueChange,
      value,
    }: {
      onValueChange?: (value: boolean) => void;
      value?: boolean;
    }) =>
      React.createElement('input', {
        checked: value ?? false,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onValueChange?.(event.target.checked),
        type: 'checkbox',
      }),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('ProductHasVariantsToggleCard', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    text: '#0f172a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  function createFormData(
    overrides: Partial<ProductEditFormData> = {}
  ): ProductEditFormData {
    return {
      category: '',
      category_id: '',
      brand: '',
      color: '',
      cost_price: 500,
      description: '',
      fulfillment_details: { items: [] },
      has_variants: false,
      images: [],
      low_stock_threshold: 0,
      manage_stock: false,
      name: 'Baci Phone',
      price: 1000,
      sku: '',
      status: 'draft',
      stock_quantity: 0,
      variant_attributes: [],
      variants: [],
      ...overrides,
    };
  }

  it('seeds a first variant when the toggle is enabled', () => {
    const setFormData = vi.fn();
    const formData = createFormData({
      images: ['https://example.com/image.jpg'],
    });

    render(
      <ProductHasVariantsToggleCard
        colors={colors}
        formData={formData}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    const updater = setFormData.mock.calls[0]?.[0] as (
      previous: ProductEditFormData
    ) => ProductEditFormData;
    const next = updater(formData);

    expect(next.has_variants).toBe(true);
    expect(next.manage_stock).toBe(true);
    expect(next.variants).toHaveLength(1);
    expect(next.variants[0]).toEqual(
      expect.objectContaining({
        cost_price: 500,
        price: 1000,
        primary_image: 'https://example.com/image.jpg',
      })
    );
  });

  it('keeps existing variants unchanged when enabling an already populated product', () => {
    const setFormData = vi.fn();
    const existingVariants = [
      {
        attributes: [],
        client_id: 'variant-1',
        condition: 'new',
        cost_price: 250,
        images: [],
        price: 500,
        primary_image: null,
        sku: 'SKU-1',
        stock_quantity: 3,
      },
    ] satisfies ProductEditFormData['variants'];
    const formData = createFormData({
      variants: existingVariants,
    });

    render(
      <ProductHasVariantsToggleCard
        colors={colors}
        formData={formData}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    const updater = setFormData.mock.calls[0]?.[0] as (
      previous: ProductEditFormData
    ) => ProductEditFormData;
    const next = updater(formData);

    expect(next.has_variants).toBe(true);
    expect(next.variants).toBe(existingVariants);
    expect(next.manage_stock).toBe(true);
  });

  it('preserves variants and manage_stock when the toggle is disabled', () => {
    const setFormData = vi.fn();
    const existingVariants = [
      {
        attributes: [],
        client_id: 'variant-1',
        condition: 'used',
        cost_price: 250,
        images: [],
        price: 500,
        primary_image: null,
        sku: 'SKU-1',
        stock_quantity: 3,
      },
    ] satisfies ProductEditFormData['variants'];
    const formData = createFormData({
      has_variants: true,
      manage_stock: true,
      variants: existingVariants,
    });

    render(
      <ProductHasVariantsToggleCard
        colors={colors}
        formData={formData}
        setFormData={setFormData}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    const updater = setFormData.mock.calls[0]?.[0] as (
      previous: ProductEditFormData
    ) => ProductEditFormData;
    const next = updater(formData);

    expect(next.has_variants).toBe(false);
    expect(next.variants).toBe(existingVariants);
    expect(next.manage_stock).toBe(true);
  });
});
