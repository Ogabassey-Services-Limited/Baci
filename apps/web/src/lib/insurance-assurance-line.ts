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
 * Add a zero-rated `O` tax subtotal for assurance — but only for VAT-registered
 * sellers. For non-registered sellers the single existing `O` subtotal already
 * spans the full tax-exclusive amount (which includes assurance), so adding
 * another row would double-count.
 */
export function appendAssuranceTaxSubtotal(
  taxSubtotals: TaxSubtotal[],
  assuranceTotal: number,
  { vatRegistered }: { vatRegistered: boolean }
): void {
  if (!vatRegistered) return;

  const existing = taxSubtotals.find(
    (subtotal) =>
      subtotal.vat_category_code === 'O' && subtotal.tax_amount === 0
  );
  if (existing) {
    existing.taxable_amount = Number(
      (existing.taxable_amount + assuranceTotal).toFixed(2)
    );
    return;
  }

  taxSubtotals.push({
    vat_category_code: 'O',
    vat_rate: 0,
    taxable_amount: assuranceTotal,
    tax_amount: 0,
    exemption_reason: ASSURANCE_EXEMPTION_REASON,
  });
}
