import type { ReceiptOrder } from '@baci/shared/receipt';
import type { InvoiceLineItem, TaxSubtotal } from '@/lib/invoice-generator';

type ReceiptLineItem = ReceiptOrder['items'][number];

/**
 * Ogabassey Assurance (MyCover device cover) is charged as a per-item
 * `assurance_fee` that is rolled into `order.subtotal`/`total` but is VAT-free
 * (the RPC computes VAT only on product line extensions). It was never
 * itemized on the invoice/receipt, so the printed lines fell short of the
 * total. These helpers add a single faithful "Ogabassey Assurance" line —
 * VAT category `O` (outside scope), zero VAT — so the document reconciles
 * exactly with zero tax-behaviour change.
 */

export const ASSURANCE_LINE_NAME = 'Ogabassey Assurance';
const ASSURANCE_LINE_DESCRIPTION = 'Device protection premium (MyCover.ai)';
const ASSURANCE_EXEMPTION_REASON = 'Insurance premium — outside scope of VAT';

function toFiniteFee(value: unknown): number {
  const fee =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : 0;
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
}

/** Sum the (server-computed) assurance fees across order item rows. */
export function sumAssuranceFees(
  items: ReadonlyArray<{ assurance_fee?: unknown }>
): number {
  const total = items.reduce(
    (sum, item) => sum + toFiniteFee(item.assurance_fee),
    0
  );
  return Number(total.toFixed(2));
}

/**
 * Next free invoice line id — one above the max existing `line_id`. Order items
 * can carry sparse/imported line ids, so `items.length + 1` could collide.
 */
export function nextInvoiceLineId(
  items: ReadonlyArray<{ line_id?: number | null }>
): number {
  const maxId = items.reduce((max, item) => {
    const id =
      typeof item.line_id === 'number' && Number.isFinite(item.line_id)
        ? item.line_id
        : 0;
    return id > max ? id : max;
  }, 0);
  return maxId + 1;
}

export function buildAssuranceInvoiceLineItem(
  lineId: number,
  assuranceTotal: number
): InvoiceLineItem {
  return {
    line_id: lineId,
    name: ASSURANCE_LINE_NAME,
    description: ASSURANCE_LINE_DESCRIPTION,
    quantity: 1,
    unit_code: 'EA',
    price: assuranceTotal,
    line_extension_amount: assuranceTotal,
    vat_category_code: 'O',
    vat_rate: 0,
    vat_amount: 0,
  };
}

export function buildAssuranceReceiptItem(
  assuranceTotal: number
): ReceiptLineItem {
  return {
    product_name: ASSURANCE_LINE_NAME,
    name: ASSURANCE_LINE_NAME,
    quantity: 1,
    price: assuranceTotal,
    line_extension_amount: assuranceTotal,
    unit_code: 'EA',
    vat_category_code: 'O',
    vat_rate: 0,
    vat_amount: 0,
  };
}

/**
 * Reconcile the tax-subtotal breakdown with the post-assurance line total.
 *
 * The assurance premium is zero-rated, so any shortfall between the line
 * total and the summed taxable amounts is folded into an `O` (outside-scope)
 * subtotal. This is robust across seller types: VAT-registered orders carry an
 * `S` subtotal for products and need a new `O` row for assurance; some
 * non-registered orders already have an `O` row whose taxable amount excludes
 * assurance (it's derived from `tax_exclusive_amount`), so the gap is added
 * there. When the existing subtotals already span the line total, the gap is
 * ~0 and nothing changes — preventing double-counting.
 */
export function reconcileAssuranceTaxSubtotal(
  taxSubtotals: TaxSubtotal[],
  lineExtensionTotal: number
): void {
  const existingTaxable = taxSubtotals.reduce(
    (sum, subtotal) => sum + subtotal.taxable_amount,
    0
  );
  const gap = Number((lineExtensionTotal - existingTaxable).toFixed(2));
  if (gap <= 0.01) return;

  const existing = taxSubtotals.find(
    (subtotal) =>
      subtotal.vat_category_code === 'O' && subtotal.tax_amount === 0
  );
  if (existing) {
    existing.taxable_amount = Number(
      (existing.taxable_amount + gap).toFixed(2)
    );
    return;
  }

  taxSubtotals.push({
    vat_category_code: 'O',
    vat_rate: 0,
    taxable_amount: gap,
    tax_amount: 0,
    exemption_reason: ASSURANCE_EXEMPTION_REASON,
  });
}

/** Sum line-extension amounts across invoice line items. */
export function sumLineExtensionAmounts(
  items: ReadonlyArray<{ line_extension_amount?: number | null }>
): number {
  const total = items.reduce(
    (sum, item) =>
      sum +
      (typeof item.line_extension_amount === 'number' &&
      Number.isFinite(item.line_extension_amount)
        ? item.line_extension_amount
        : 0),
    0
  );
  return Number(total.toFixed(2));
}
