import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchTransactionReviewRows: vi.fn(),
}));

vi.mock('./fetch-transaction-review-rows', () => ({
  fetchTransactionReviewRows: mocks.fetchTransactionReviewRows,
}));

import { fetchTransactionReviewWithFallbacks } from './fetch-transaction-review-with-fallbacks';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

const schemaCacheError = {
  code: 'PGRST204',
  message:
    "Could not find the 'variant_id' column of 'order_items' in the schema cache",
};

describe('fetchTransactionReviewWithFallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the full projection without retrying when the schema is current', async () => {
    const rows = [{ id: 'order-1' }];
    mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
      data: rows,
      error: null,
    });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledWith(
      expect.objectContaining({
        includeCancelledAt: true,
        includeTransactionDate: true,
      })
    );
  });

  it('keeps cancellation filtering on discount-aware base fallbacks', async () => {
    const rows = [{ id: 'legacy-cancellation-filter-order' }];
    const genericSchemaCacheError = {
      code: 'PGRST204',
      message:
        'Could not find a requested order_items field in the schema cache',
    };
    let attempt = 0;
    mocks.fetchTransactionReviewRows.mockImplementation(
      async ({ selectStatement }) => {
        attempt += 1;
        if (attempt === 1) {
          return {
            data: null,
            error: {
              code: 'PGRST204',
              message:
                "Could not find the 'line_id' column of 'order_items' in the schema cache",
            },
          };
        }
        if (
          selectStatement ===
          TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantId
        ) {
          return { data: rows, error: null };
        }
        return { data: null, error: genericSchemaCacheError };
      }
    );

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    const noLineIdCall = mocks.fetchTransactionReviewRows.mock.calls.find(
      ([options]) =>
        options.selectStatement ===
        TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineId
    );
    const noVariantIdCall = mocks.fetchTransactionReviewRows.mock.calls.find(
      ([options]) =>
        options.selectStatement ===
        TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantId
    );

    expect(noLineIdCall?.[0]).toEqual(
      expect.objectContaining({ includeCancelledAt: true })
    );
    expect(noVariantIdCall?.[0]).toEqual(
      expect.objectContaining({ includeCancelledAt: true })
    );
  });

  it('uses a cost-rich projection when variant attributes are unavailable', async () => {
    const rows = [{ id: 'legacy-variant-attributes-order' }];
    const variantAttributesSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'variant_attributes' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({
        data: null,
        error: variantAttributesSchemaError,
      })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(2);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[1][0].selectStatement;
    expect(selector).not.toContain('variant_attributes');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
  });

  it('uses the full cost-rich projection when discount code ids are unavailable', async () => {
    const rows = [{ id: 'full-discount-code-fallback-order' }];
    const discountCodeSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'discount_code_id' column of 'orders' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: discountCodeSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(2);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[1][0].selectStatement;
    expect(selector).not.toContain('discount_code_id');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
    expect(selector).toContain('cost_price');
  });

  it('uses a cost-rich projection when variant ids are unavailable', async () => {
    const rows = [{ id: 'full-variant-id-fallback-order' }];
    const variantIdSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'variant_id' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: variantIdSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(2);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[1][0].selectStatement;
    expect(selector).not.toContain('variant_id');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).not.toContain('product_variants');
    expect(selector).toContain('cost_price');
  });

  it('uses a rich projection when quiz award ids are unavailable', async () => {
    const rows = [{ id: 'full-quiz-award-id-fallback-order' }];
    const quizAwardIdSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'quiz_award_id' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: quizAwardIdSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(2);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[1][0].selectStatement;
    expect(selector).not.toContain('quiz_award_id');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
    expect(selector).toContain('cost_price');
  });

  it('keeps quiz award ids excluded across a variant-attributes fallback', async () => {
    const rows = [{ id: 'quiz-and-variant-attributes-fallback-order' }];
    const quizAwardIdSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'quiz_award_id' column of 'order_items' in the schema cache",
    };
    const variantAttributesSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'variant_attributes' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: quizAwardIdSchemaError })
      .mockResolvedValueOnce({
        data: null,
        error: variantAttributesSchemaError,
      })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(3);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement;
    expect(selector).not.toContain('quiz_award_id');
    expect(selector).not.toContain('variant_attributes');
    expect(selector).toContain('order_item_unit_costs');
  });

  it('retries a variant-attributes fallback after discovering quiz award ids are missing', async () => {
    const rows = [{ id: 'variant-attributes-and-quiz-fallback-order' }];
    const variantAttributesSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'variant_attributes' column of 'order_items' in the schema cache",
    };
    const quizAwardIdSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'quiz_award_id' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({
        data: null,
        error: variantAttributesSchemaError,
      })
      .mockResolvedValueOnce({ data: null, error: quizAwardIdSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(3);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement;
    expect(selector).not.toContain('quiz_award_id');
    expect(selector).not.toContain('variant_attributes');
    expect(selector).toContain('order_item_unit_costs');
  });

  it('keeps discount provenance when the tax amount column is unavailable', async () => {
    const rows = [{ id: 'tax-column-fallback-order' }];
    const taxAmountSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'tax_amount' column of 'orders' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: taxAmountSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(2);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[1][0].selectStatement;
    expect(selector).not.toContain('tax_amount');
    expect(selector).toContain('discount_amount');
    expect(selector).toContain('discount_code_id');
    expect(selector).toContain('ad_tracking');
    expect(selector).toContain('order_item_unit_costs');
  });

  it('uses the older cost-rich projection when later schema fields are unavailable', async () => {
    const rows = [{ id: 'legacy-variant-attributes-order' }];
    const variantAttributesSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'variant_attributes' column of 'order_items' in the schema cache",
    };
    const discountCodeSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'discount_code_id' column of 'orders' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({
        data: null,
        error: variantAttributesSchemaError,
      })
      .mockResolvedValueOnce({ data: null, error: discountCodeSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(3);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement;
    expect(selector).not.toContain('variant_attributes');
    expect(selector).not.toContain('discount_code_id');
    expect(selector).not.toContain('order_item_unit_costs');
    expect(selector).toContain('cost_price');
    expect(selector).toContain('assurance_fee');
    expect(selector).toContain('product_variants');
  });

  it('uses a cost-rich projection when product match status is unavailable', async () => {
    const rows = [{ id: 'legacy-product-match-status-order' }];
    const productMatchStatusSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'product_match_status' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({
        data: null,
        error: productMatchStatusSchemaError,
      })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(2);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[1][0].selectStatement;
    expect(selector).not.toContain('product_match_status');
    expect(selector).toContain('assurance_fee');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
  });

  it('uses the final projection without variant_id after schema-cache retries', async () => {
    const rows = [{ id: 'legacy-order' }];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
        data: null,
        error: schemaCacheError,
      });
    }
    mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
      data: rows,
      error: null,
    });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(13);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[12][0].selectStatement
    ).not.toContain('variant_id');
  });

  it('uses the final projection without quiz award ids when the voucher column is unavailable', async () => {
    const rows = [{ id: 'pre-voucher-migration-order' }];
    const quizAwardIdSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'quiz_award_id' column of 'order_items' in the schema cache",
    };
    for (let attempt = 0; attempt < 14; attempt += 1) {
      mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
        data: null,
        error: quizAwardIdSchemaError,
      });
    }
    mocks.fetchTransactionReviewRows.mockResolvedValueOnce({
      data: rows,
      error: null,
    });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(15);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[14][0].selectStatement
    ).not.toContain('quiz_award_id');
  });

  it('composes quiz and line-id omissions in the rich fallback', async () => {
    const rows = [{ id: 'line-and-quiz-fallback-order' }];
    const lineIdSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'line_id' column of 'order_items' in the schema cache",
    };
    const quizAwardIdSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'quiz_award_id' column of 'order_items' in the schema cache",
    };

    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: lineIdSchemaError })
      .mockResolvedValueOnce({ data: null, error: quizAwardIdSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(3);
    const selector =
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement;
    expect(selector).not.toContain('line_id');
    expect(selector).not.toContain('quiz_award_id');
    expect(selector).toContain('order_item_unit_costs');
  });

  it('preserves cost relationships when adjustment columns are unavailable', async () => {
    const rows = [{ id: 'legacy-adjustment-order' }];
    const adjustmentSchemaError = {
      code: 'PGRST204',
      message:
        "Could not find the 'vat_rate' column of 'order_items' in the schema cache",
    };
    mocks.fetchTransactionReviewRows
      .mockResolvedValueOnce({ data: null, error: adjustmentSchemaError })
      .mockResolvedValueOnce({ data: null, error: adjustmentSchemaError })
      .mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTransactionReviewWithFallbacks({
      merchantId: 'merchant-1',
    });

    expect(result).toEqual({ data: rows, error: null });
    expect(mocks.fetchTransactionReviewRows).toHaveBeenCalledTimes(3);
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement
    ).toContain('order_item_unit_costs');
    expect(
      mocks.fetchTransactionReviewRows.mock.calls[2][0].selectStatement
    ).not.toContain('vat_rate');
  });
});
