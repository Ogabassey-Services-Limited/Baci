import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewChanges } from './review-changes';

const mocks = vi.hoisted(() => ({
  applyChanges: vi.fn(),
  setWorkflowStep: vi.fn(),
  toast: vi.fn(),
  useMerchant: vi.fn(),
  useProductContext: vi.fn(),
}));

vi.mock('@/app/dashboard/products/generation-actions', () => ({
  enrichProductsBatch: vi.fn(),
}));

vi.mock('@/contexts/product-context', () => ({
  useProductContext: mocks.useProductContext,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

describe('ReviewChanges cost price editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyChanges.mockResolvedValue(undefined);
    mocks.useMerchant.mockReturnValue({
      merchant: {
        country: null,
        payout_currency: 'NGN',
        plan_tier: 'free',
      },
    });
    mocks.useProductContext.mockReturnValue({
      aiResponse: {
        changes: [
          {
            details: {
              category: 'General',
              cost_price: 700,
              name: 'Imported Product',
              price: 1200,
              sku: 'SKU-1',
              stock: 5,
            },
            type: 'new',
          },
        ],
        summary: 'Parsed 1 product from CSV',
      },
      applyChanges: mocks.applyChanges,
      setWorkflowStep: mocks.setWorkflowStep,
    });
  });

  it('accepts currency-formatted cost price edits before saving', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    fireEvent.change(screen.getByDisplayValue('700'), {
      target: { value: 'NGN2,000' },
    });
    await user.click(screen.getByRole('button', { name: /import & publish/i }));

    await waitFor(() => {
      expect(mocks.applyChanges).toHaveBeenCalledWith([
        expect.objectContaining({
          details: expect.objectContaining({
            cost_price: 2000,
            cost_price_was_edited: true,
          }),
        }),
      ]);
    });
  });

  it('parses comma-decimal cost price edits before saving', async () => {
    const user = userEvent.setup();
    mocks.useMerchant.mockReturnValue({
      merchant: {
        country: 'BR',
        payout_currency: 'BRL',
        plan_tier: 'free',
      },
    });
    render(<ReviewChanges />);

    fireEvent.change(screen.getByDisplayValue('700'), {
      target: { value: '800,5' },
    });
    await user.click(screen.getByRole('button', { name: /import & publish/i }));

    await waitFor(() => {
      expect(mocks.applyChanges).toHaveBeenCalledWith([
        expect.objectContaining({
          details: expect.objectContaining({
            cost_price: 800.5,
            cost_price_was_edited: true,
          }),
        }),
      ]);
    });
  });

  it('sends null when the cost price input is cleared', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    const costPriceInput = screen.getByDisplayValue('700');
    fireEvent.change(costPriceInput, { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: /import & publish/i }));

    await waitFor(() => {
      expect(mocks.applyChanges).toHaveBeenCalledWith([
        expect.objectContaining({
          details: expect.objectContaining({
            cost_price: null,
            cost_price_was_edited: true,
          }),
          type: 'new',
        }),
      ]);
    });
  });

  it('blocks invalid cost price edits before applying stale values', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    const costPriceInput = screen.getByDisplayValue('700');
    fireEvent.change(costPriceInput, { target: { value: '800' } });
    fireEvent.change(costPriceInput, { target: { value: 'abc' } });

    const importButton = screen.getByRole('button', {
      name: /import & publish/i,
    });
    expect(
      screen.getByText('Enter a valid non-negative cost price before import.')
    ).toBeVisible();
    expect(costPriceInput).toHaveAttribute('aria-invalid', 'true');
    expect(importButton).toBeDisabled();

    await user.click(importButton);

    expect(mocks.applyChanges).not.toHaveBeenCalled();
  });

  it('does not block remove-only rows on ignored price edits', async () => {
    const user = userEvent.setup();
    mocks.useProductContext.mockReturnValue({
      aiResponse: {
        changes: [
          {
            details: {
              category: 'General',
              name: 'Old Product',
              price: 1200,
              sku: 'OLD-1',
              stock: 0,
            },
            productId: 'product-1',
            type: 'remove',
          },
        ],
        summary: 'Remove 1 stale product',
      },
      applyChanges: mocks.applyChanges,
      setWorkflowStep: mocks.setWorkflowStep,
    });

    render(<ReviewChanges />);

    fireEvent.change(screen.getByRole('textbox', { name: /^price$/i }), {
      target: { value: '-5' },
    });

    const importButton = screen.getByRole('button', {
      name: /import & publish/i,
    });
    expect(importButton).not.toBeDisabled();

    await user.click(importButton);

    expect(mocks.applyChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        productId: 'product-1',
        type: 'remove',
      }),
    ]);
  });

  it('keeps cleared cost price optional but blocks a later invalid edit', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    const costPriceInput = screen.getByDisplayValue('700');
    fireEvent.change(costPriceInput, { target: { value: '' } });
    expect(costPriceInput).toHaveAttribute('aria-invalid', 'false');

    fireEvent.change(costPriceInput, { target: { value: '-5' } });

    const importButton = screen.getByRole('button', {
      name: /import & publish/i,
    });
    expect(importButton).toBeDisabled();

    await user.click(importButton);

    expect(mocks.applyChanges).not.toHaveBeenCalled();
  });
});
