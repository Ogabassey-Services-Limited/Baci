import { describe, expect, it, vi } from 'vitest';
import { fetchFullTransactionReviewRows } from './fetch-transaction-review-full-fallback';

const isMissingSchemaColumn = (error: unknown, column: string) =>
  String((error as { message?: string })?.message).includes(column);

describe('fetchFullTransactionReviewRows', () => {
  it('retries with the cost-rich variant-free selector', async () => {
    const runQueryWithTaxFallback = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: 'variant_id unavailable' },
      })
      .mockResolvedValueOnce({ data: [{ id: 'order-1' }], error: null });

    const result = await fetchFullTransactionReviewRows(
      { merchantId: 'merchant-1' },
      {
        isMissingSchemaColumn: (error, column) =>
          column === 'variant_id' && isMissingSchemaColumn(error, column),
        runQueryWithTaxFallback,
      }
    );

    expect(result).toEqual({ data: [{ id: 'order-1' }], error: null });
    expect(runQueryWithTaxFallback).toHaveBeenCalledTimes(2);
    expect(
      runQueryWithTaxFallback.mock.calls[1]?.[1].selectStatement
    ).not.toContain('variant_id');
    expect(
      runQueryWithTaxFallback.mock.calls[1]?.[1].selectStatement
    ).toContain('order_item_unit_costs');
  });

  it('retries without the discount code id while keeping cost fields', async () => {
    const runQueryWithTaxFallback = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: 'discount_code_id unavailable' },
      })
      .mockResolvedValueOnce({ data: [{ id: 'order-2' }], error: null });

    const result = await fetchFullTransactionReviewRows(
      { merchantId: 'merchant-1' },
      { isMissingSchemaColumn, runQueryWithTaxFallback }
    );

    expect(result).toEqual({ data: [{ id: 'order-2' }], error: null });
    expect(runQueryWithTaxFallback.mock.calls[1]?.[0]).toBe(
      'FullNoDiscountCode'
    );
    expect(
      runQueryWithTaxFallback.mock.calls[1]?.[1].selectStatement
    ).not.toContain('discount_code_id');
    expect(
      runQueryWithTaxFallback.mock.calls[1]?.[1].selectStatement
    ).toContain('order_item_unit_costs');
  });

  it('retries the combined selector when discount code fails before variant id', async () => {
    const runQueryWithTaxFallback = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: 'discount_code_id unavailable' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: 'variant_id unavailable' },
      })
      .mockResolvedValueOnce({ data: [{ id: 'order-3' }], error: null });

    const result = await fetchFullTransactionReviewRows(
      { merchantId: 'merchant-1' },
      { isMissingSchemaColumn, runQueryWithTaxFallback }
    );

    expect(result).toEqual({ data: [{ id: 'order-3' }], error: null });
    expect(runQueryWithTaxFallback.mock.calls[1]?.[0]).toBe(
      'FullNoDiscountCode'
    );
    expect(runQueryWithTaxFallback.mock.calls[2]?.[0]).toBe(
      'FullNoVariantIdNoDiscountCode'
    );
    const selector =
      runQueryWithTaxFallback.mock.calls[2]?.[1].selectStatement ?? '';
    expect(selector).not.toContain('variant_id');
    expect(selector).not.toContain('discount_code_id');
    expect(selector).toContain('order_item_unit_costs');
  });

  it('returns the final schema error when every full projection fails', async () => {
    const finalError = {
      code: 'PGRST204',
      message: 'unexpected schema cache failure',
    };
    const runQueryWithTaxFallback = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: 'discount_code_id unavailable' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: 'discount_amount unavailable' },
      })
      .mockResolvedValueOnce({ data: null, error: finalError });

    const result = await fetchFullTransactionReviewRows(
      { merchantId: 'merchant-1' },
      { isMissingSchemaColumn, runQueryWithTaxFallback }
    );

    expect(result).toEqual({ data: null, error: finalError });
  });
});
