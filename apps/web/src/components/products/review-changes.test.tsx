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

describe('ReviewChanges', () => {
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

  it('uses payout currency and applies edited cost price from the review table', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    expect(screen.getAllByText('₦').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Cost Price')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /cost price/i })
    ).toHaveAttribute('inputmode', 'decimal');

    const costPriceInput = screen.getByDisplayValue('700');
    fireEvent.change(costPriceInput, { target: { value: '800' } });
    await user.click(screen.getByRole('button', { name: /import & publish/i }));

    await waitFor(() => {
      expect(mocks.applyChanges).toHaveBeenCalledWith([
        expect.objectContaining({
          details: expect.objectContaining({
            cost_price: 800,
            cost_price_was_edited: true,
          }),
          type: 'new',
        }),
      ]);
    });
  });

  it('shows a recovery action when there is no AI response to review', async () => {
    const user = userEvent.setup();
    mocks.useProductContext.mockReturnValue({
      aiResponse: undefined,
      applyChanges: mocks.applyChanges,
      setWorkflowStep: mocks.setWorkflowStep,
    });

    render(<ReviewChanges />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No AI response to review. Please try uploading a file again.'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go to upload/i }));

    expect(mocks.setWorkflowStep).toHaveBeenCalledWith('upload');
    expect(mocks.applyChanges).not.toHaveBeenCalled();
  });

  it('keeps cost price input raw while typing decimal separators', () => {
    render(<ReviewChanges />);

    const costPriceInput = screen.getByDisplayValue('700');
    fireEvent.change(costPriceInput, { target: { value: '800.' } });
    expect(costPriceInput).toHaveValue('800.');

    fireEvent.change(costPriceInput, { target: { value: '800.5' } });

    expect(costPriceInput).toHaveValue('800.5');
    expect(screen.queryByDisplayValue('800.50')).not.toBeInTheDocument();
  });

  it('keeps selling price input raw and parses comma-decimal edits before saving', async () => {
    const user = userEvent.setup();
    mocks.useMerchant.mockReturnValue({
      merchant: {
        country: 'BR',
        payout_currency: 'BRL',
        plan_tier: 'free',
      },
    });
    render(<ReviewChanges />);

    const priceInput = screen.getByRole('textbox', { name: /^price$/i });
    fireEvent.change(priceInput, { target: { value: '800,' } });
    expect(priceInput).toHaveValue('800,');

    fireEvent.change(priceInput, { target: { value: '800,5' } });
    await user.click(screen.getByRole('button', { name: /import & publish/i }));

    await waitFor(() => {
      expect(mocks.applyChanges).toHaveBeenCalledWith([
        expect.objectContaining({
          details: expect.objectContaining({
            price: 800.5,
          }),
        }),
      ]);
    });
  });

  it('blocks import when the required selling price input is cleared', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    const priceInput = screen.getByRole('textbox', { name: /^price$/i });
    fireEvent.change(priceInput, { target: { value: '' } });

    const importButton = screen.getByRole('button', {
      name: /import & publish/i,
    });
    expect(screen.getByText('Price is required before import.')).toBeVisible();
    expect(priceInput).toHaveAttribute('aria-invalid', 'true');
    expect(importButton).toBeDisabled();

    await user.click(importButton);

    expect(mocks.applyChanges).not.toHaveBeenCalled();
  });

  it('blocks import when a selected selling price edit is invalid', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    const priceInput = screen.getByRole('textbox', { name: /^price$/i });
    fireEvent.change(priceInput, { target: { value: 'abc' } });

    const importButton = screen.getByRole('button', {
      name: /import & publish/i,
    });
    expect(
      screen.getByText('Enter a valid non-negative price before import.')
    ).toBeVisible();
    expect(priceInput).toHaveAttribute('aria-invalid', 'true');
    expect(importButton).toBeDisabled();

    await user.click(importButton);

    expect(mocks.applyChanges).not.toHaveBeenCalled();
  });

  it('blocks non-finite selling price edits before import', async () => {
    const user = userEvent.setup();
    render(<ReviewChanges />);

    const priceInput = screen.getByRole('textbox', { name: /^price$/i });
    fireEvent.change(priceInput, { target: { value: '1e9999' } });

    const importButton = screen.getByRole('button', {
      name: /import & publish/i,
    });
    expect(importButton).toBeDisabled();

    await user.click(importButton);

    expect(mocks.applyChanges).not.toHaveBeenCalled();
  });
});
