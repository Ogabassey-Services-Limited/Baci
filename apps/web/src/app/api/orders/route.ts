import {
  appendReceiptFulfillmentDescription,
  formatCanonicalProductConditionLabel,
  isDeviceReceiptItemName,
  normalizeReceiptFulfillmentDetails,
  type ReceiptFulfillmentDetails,
  type ReceiptMerchant,
  type ReceiptOrder,
} from '@baci/shared';
import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { getQuizPhaseEnv, getQuizProductionApprovedEnv } from '@/env';
import {
  computeAgenticOrderTax,
  isTaxComputeUuidError,
} from '@/lib/agentic/checkout-order-tax';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import {
  computeCanonicalOrderSubtotal,
  isCanonicalOrderSubtotalUuidError,
} from '@/lib/checkout/canonical-order-subtotal';
import { DEFAULT_ASSURANCE_RATE } from '@/lib/checkout/constants';
import { computeDiscountAmountForSubtotal } from '@/lib/checkout/discount-amount';
import {
  buildOrderIdempotencyPayload,
  hashOrderIdempotencyPayload,
} from '@/lib/checkout/order-idempotency';
import { computeOrderNegotiationDiscount } from '@/lib/checkout/order-negotiation-discount';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { hasPriceNegotiationEntitlement } from '@/lib/feature-flags';
import { formatVariantAttributesLabel } from '@/lib/format-variant-attributes-label';
import { detectPrivacyRegion } from '@/lib/geo-privacy';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import type {
  InvoiceData,
  InvoiceLineItem,
  TaxSubtotal,
} from '@/lib/invoice-generator';
import { mergeReceiptItemsWithInvoiceMetadata } from '@/lib/invoice-receipt-item-metadata';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { generatePaymentAccount } from '@/lib/paystack';
import {
  generatePeppolInvoiceXml,
  PEPPOL_BIS_BILLING_COMPLIANCE_NOTE,
} from '@/lib/peppol-ubl-invoice';
import {
  enforcePrizeProductionGuard,
  QuizProductionNotApprovedError,
} from '@/lib/quiz-compliance-gate';
import { createQuizRpcServerProof } from '@/lib/quiz-proof';
import { verifyQuizVoucherToken } from '@/lib/quiz-voucher-token';
import { getClientIdentifier } from '@/lib/rate-limit';
import {
  generateReceiptBlob,
  resolveReceiptLogoDataUri,
} from '@/lib/receipt-pdf-generator';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import {
  enrichShippingAddressWithQuoteDestination,
  OrderQuoteDestinationMismatchError,
} from '@/lib/shipping/order-quote-destination';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';
import { type OrderCreateInput, orderCreateSchema } from '@/schemas/orders';
import { storefrontDiscountCodeRowSchema } from '@/schemas/storefront-discount';

function isPayOnDelivery(paymentMethod: string): boolean {
  return paymentMethod === 'pod' || paymentMethod === 'pay_on_delivery';
}

function getRequestIdempotencyKey(request: NextRequest) {
  const headerValue = request.headers.get('idempotency-key')?.trim();
  return headerValue ? headerValue : null;
}

function getSavingsRedemptionIdempotencyKey({
  customerEmail,
  items,
  merchantId,
  requestIdempotencyKey,
  savingsAmount,
  savingsGoalId,
}: {
  customerEmail: string;
  items: Array<{
    product_id: string;
    quantity: number;
    variant_id?: string | null;
  }>;
  merchantId: string;
  requestIdempotencyKey: string | null;
  savingsAmount: number;
  savingsGoalId: string;
}) {
  if (requestIdempotencyKey) {
    return `order:${requestIdempotencyKey}:savings`;
  }

  const itemFingerprint = items
    .map(
      (item) => `${item.product_id}:${item.variant_id ?? ''}:${item.quantity}`
    )
    .join('|');
  return [
    'order_savings',
    merchantId,
    customerEmail.toLowerCase(),
    savingsGoalId,
    savingsAmount,
    itemFingerprint,
  ].join(':');
}

/** Server-authoritative assurance rate — never trust the client value. */
const SERVER_ASSURANCE_RATE = DEFAULT_ASSURANCE_RATE;
// Imported from @/lib/feature-flags

type EmailOrderItem = {
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number;
};

type QuizVoucherItemCandidate = {
  voucherAwardId?: unknown;
  voucherToken?: unknown;
  voucher_award_id?: unknown;
  voucher_token?: unknown;
};
type OrderCreateItem = OrderCreateInput['items'][number];
type ImmediateInvoiceOrderItem = Omit<OrderCreateItem, 'assurance_fee'> & {
  assurance_fee?: number;
  item_description?: string | null;
  line_extension_amount?: number | null;
  sellers_item_id?: string | null;
  unit_code?: string | null;
  variant_name?: string | null;
  vat_amount?: number | null;
  vat_category_code?: string | null;
  vat_rate?: number | null;
};
type PersistedInvoiceOrderItemRow = {
  assurance_fee?: unknown;
  condition?: unknown;
  has_assurance?: unknown;
  id?: unknown;
  item_description?: unknown;
  line_extension_amount?: unknown;
  name?: unknown;
  price?: unknown;
  product_id?: unknown;
  quantity?: unknown;
  sellers_item_id?: unknown;
  unit_code?: unknown;
  variant_attributes?: unknown;
  variant_id?: unknown;
  variant_name?: unknown;
  vat_amount?: unknown;
  vat_category_code?: unknown;
  vat_rate?: unknown;
};

const IMMEDIATE_INVOICE_DUE_DAYS = 14;
const PERSISTED_INVOICE_ITEMS_LOOKUP_ATTEMPTS = 3;
const PERSISTED_INVOICE_ITEMS_RETRY_DELAY_MS = 50;

function hasNonEmptyVoucherIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasQuizVoucherIdentifier(item: QuizVoucherItemCandidate): boolean {
  return (
    hasNonEmptyVoucherIdentifier(item.voucher_award_id) ||
    hasNonEmptyVoucherIdentifier(item.voucherAwardId) ||
    hasNonEmptyVoucherIdentifier(item.voucher_token) ||
    hasNonEmptyVoucherIdentifier(item.voucherToken)
  );
}

function hasQuizVoucherItem(items: QuizVoucherItemCandidate[]): boolean {
  return items.some((item) => hasQuizVoucherIdentifier(item));
}

function getQuizVoucherToken(item: QuizVoucherItemCandidate): string | null {
  if (hasNonEmptyVoucherIdentifier(item.voucher_token)) {
    return item.voucher_token.trim();
  }

  if (hasNonEmptyVoucherIdentifier(item.voucherToken)) {
    return item.voucherToken.trim();
  }

  return null;
}

function getOrderItemProductId(item: OrderCreateItem): string | undefined {
  return item.product_id || item.productId || item.id;
}

function getOrderItemVariantId(item: OrderCreateItem): string | null {
  return item.variantId || item.variant_id || null;
}

function getOrderItemCondition(item: OrderCreateItem): string | null {
  return item.condition || null;
}

function getOrderItemBaseName(item: OrderCreateItem): string {
  return item.name || item.productName || 'Product';
}

function getOrderItemVariantLabel(
  item: OrderCreateItem,
  options: { includeConditionFallback?: boolean } = {}
): string | null {
  const label = formatVariantAttributesLabel(
    item.variantAttributes || item.variant_attributes
  );

  if (label) {
    return label;
  }

  const variantName = (item as { variant_name?: unknown }).variant_name;
  if (typeof variantName === 'string' && variantName.trim().length > 0) {
    return variantName.trim();
  }

  return options.includeConditionFallback === false
    ? null
    : (formatCanonicalProductConditionLabel(item.condition) ?? null);
}

function getOrderFulfillmentDetails(
  order: Record<string, unknown>
): ReceiptFulfillmentDetails | null {
  return normalizeReceiptFulfillmentDetails(order.fulfillment_details);
}

function toReceiptRecord<T>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as T;
}

function buildImmediateInvoiceMerchant(merchant: {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_code?: string | null;
  bank_name?: string | null;
  brand_colors?: unknown;
  business_address?: string | null;
  business_name?: string | null;
  cac_rc_number?: string | null;
  email?: string | null;
  legal_entity_name?: string | null;
  logo_url?: string | null;
  pages?: unknown;
  phone?: string | null;
  registered_address?: unknown;
  social_media?: unknown;
  support_email?: string | null;
  support_phone?: string | null;
  tax_identification_number?: string | null;
  vat_rate?: number | null;
  vat_registration_status?: string | null;
}): ReceiptMerchant {
  return {
    business_name: merchant.business_name || null,
    logo_url: merchant.logo_url || null,
    email: merchant.email || merchant.support_email || '',
    phone: merchant.phone || null,
    support_email: merchant.support_email || null,
    support_phone: merchant.support_phone || null,
    business_address: merchant.business_address || null,
    registered_address: toReceiptRecord<ReceiptMerchant['registered_address']>(
      merchant.registered_address
    ),
    cac_rc_number: merchant.cac_rc_number || null,
    tax_identification_number: merchant.tax_identification_number || null,
    legal_entity_name: merchant.legal_entity_name || null,
    brand_colors: toReceiptRecord<ReceiptMerchant['brand_colors']>(
      merchant.brand_colors
    ),
    vat_registration_status: merchant.vat_registration_status || null,
    vat_rate: merchant.vat_rate ?? null,
    bank_code: merchant.bank_code || null,
    bank_account_number: merchant.bank_account_number || null,
    bank_name: merchant.bank_name || null,
    bank_account_name: merchant.bank_account_name || null,
    social_media: toReceiptRecord<ReceiptMerchant['social_media']>(
      merchant.social_media
    ),
    pages: toReceiptRecord<ReceiptMerchant['pages']>(merchant.pages),
  };
}

function buildImmediateInvoiceShippingAddress(
  shippingAddress: OrderCreateInput['shipping_address']
): ReceiptOrder['shipping_address'] {
  if (!shippingAddress) {
    return null;
  }

  return {
    address_line1: shippingAddress.address,
    city: shippingAddress.city,
    state: shippingAddress.state,
    country: 'NG',
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getImmediateInvoiceIssueDate(order: Record<string, unknown>) {
  return new Date(
    typeof order.created_at === 'string' ? order.created_at : Date.now()
  );
}

function getImmediateInvoiceDueDate(order: Record<string, unknown>) {
  const issueDate = getImmediateInvoiceIssueDate(order);

  return new Date(
    issueDate.getTime() + IMMEDIATE_INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000
  );
}

function toFiniteNumber(value: unknown): number | null {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, entryValue]) =>
      typeof entryValue === 'string' ? [key, entryValue] : null
    )
    .filter((entry): entry is [string, string] => entry !== null);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function getOrderItemUnitPrice(item: OrderCreateItem) {
  return item.negotiatedPrice ?? item.price;
}

function getOrderItemAssuranceFee(item: ImmediateInvoiceOrderItem) {
  const persistedAssuranceFee = toFiniteNumber(item.assurance_fee);
  if (persistedAssuranceFee !== null) {
    return roundCurrency(persistedAssuranceFee);
  }

  const itemBaseTotal = item.quantity * getOrderItemUnitPrice(item);

  return item.has_assurance
    ? roundCurrency(itemBaseTotal * SERVER_ASSURANCE_RATE)
    : 0;
}

function getOrderItemLineExtensionAmount(item: ImmediateInvoiceOrderItem) {
  const persistedLineExtensionAmount = toFiniteNumber(
    item.line_extension_amount
  );

  if (persistedLineExtensionAmount !== null) {
    return roundCurrency(persistedLineExtensionAmount);
  }

  return roundCurrency(
    item.quantity * getOrderItemUnitPrice(item) + getOrderItemAssuranceFee(item)
  );
}

function normalizePersistedInvoiceOrderItems(
  rows: unknown
): ImmediateInvoiceOrderItem[] | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const normalizedItems = rows
    .map((row): ImmediateInvoiceOrderItem | null => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const typedRow = row as PersistedInvoiceOrderItemRow;
      const quantity = toFiniteNumber(typedRow.quantity);
      const price = toFiniteNumber(typedRow.price);
      const name = getOptionalString(typedRow.name) ?? 'Product';
      const fallbackIdentifier =
        getOptionalString(typedRow.product_id) ??
        getOptionalString(typedRow.id);

      if (!quantity || quantity <= 0 || price === null || price < 0) {
        return null;
      }

      return {
        condition: getOptionalString(typedRow.condition) ?? undefined,
        id: fallbackIdentifier,
        product_id: getOptionalString(typedRow.product_id),
        productName: undefined,
        name,
        quantity,
        price,
        variant_id: getOptionalString(typedRow.variant_id),
        variant_attributes: getStringRecord(typedRow.variant_attributes),
        has_assurance: typedRow.has_assurance === true,
        assurance_fee: toFiniteNumber(typedRow.assurance_fee) ?? undefined,
        item_description: getOptionalString(typedRow.item_description) ?? null,
        line_extension_amount: toFiniteNumber(typedRow.line_extension_amount),
        sellers_item_id: getOptionalString(typedRow.sellers_item_id) ?? null,
        unit_code: getOptionalString(typedRow.unit_code) ?? null,
        variant_name: getOptionalString(typedRow.variant_name) ?? null,
        vat_amount: toFiniteNumber(typedRow.vat_amount),
        vat_category_code:
          getOptionalString(typedRow.vat_category_code) ?? null,
        vat_rate: toFiniteNumber(typedRow.vat_rate),
      };
    })
    .filter((item): item is ImmediateInvoiceOrderItem => item !== null);

  return normalizedItems.length > 0 ? normalizedItems : null;
}

async function delayPersistedInvoiceItemRetry(attempt: number) {
  await new Promise((resolve) =>
    setTimeout(resolve, attempt * PERSISTED_INVOICE_ITEMS_RETRY_DELAY_MS)
  );
}

async function loadPersistedInvoiceOrderItems({
  orderId,
  supabase,
}: {
  orderId: string;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  let lastError: unknown = null;

  for (
    let attempt = 1;
    attempt <= PERSISTED_INVOICE_ITEMS_LOOKUP_ATTEMPTS;
    attempt += 1
  ) {
    const { data, error } = await supabase
      .from('order_items')
      .select(
        'id, product_id, variant_id, variant_attributes, variant_name, condition, name, quantity, price, has_assurance, assurance_fee, item_description, line_extension_amount, vat_category_code, vat_rate, vat_amount, sellers_item_id, unit_code'
      )
      .eq('order_id', orderId)
      .order('line_id', { ascending: true });

    if (!error) {
      const normalizedItems = normalizePersistedInvoiceOrderItems(data);
      if (normalizedItems) {
        return normalizedItems;
      }

      lastError = new Error('Persisted invoice items not visible yet');
      if (attempt < PERSISTED_INVOICE_ITEMS_LOOKUP_ATTEMPTS) {
        await delayPersistedInvoiceItemRetry(attempt);
        continue;
      }

      return null;
    }

    lastError = error;
    logger.error({
      message: 'Failed to load persisted order items for invoice email',
      alert: 'invoice_order_items_lookup_failed',
      attempt,
      attempts: PERSISTED_INVOICE_ITEMS_LOOKUP_ATTEMPTS,
      orderId,
      error,
    });

    if (attempt < PERSISTED_INVOICE_ITEMS_LOOKUP_ATTEMPTS) {
      await delayPersistedInvoiceItemRetry(attempt);
    }
  }

  logger.error({
    message: 'Persisted order item lookup exhausted for invoice email',
    alert: 'invoice_order_items_lookup_exhausted',
    attempts: PERSISTED_INVOICE_ITEMS_LOOKUP_ATTEMPTS,
    orderId,
    error: lastError,
  });
  return null;
}

function allocateLineTax(input: {
  index: number;
  itemCount: number;
  lineExtensionAmount: number;
  lineExtensionTotal: number;
  taxAmount: number;
  allocatedTaxAmount: number;
}) {
  if (input.taxAmount <= 0 || input.lineExtensionTotal <= 0) {
    return 0;
  }

  if (input.index === input.itemCount - 1) {
    return roundCurrency(input.taxAmount - input.allocatedTaxAmount);
  }

  return roundCurrency(
    (input.lineExtensionAmount / input.lineExtensionTotal) * input.taxAmount
  );
}

function buildImmediatePeppolInvoiceData(input: {
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  fulfillment: ReceiptFulfillmentDetails | null;
  items: ImmediateInvoiceOrderItem[];
  merchant: {
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    bank_name?: string | null;
    business_name: string;
    cac_rc_number?: string | null;
    legal_entity_name?: string | null;
    logo_url?: string | null;
    registered_address?: InvoiceData['merchant']['registered_address'] | null;
    support_email?: string | null;
    support_phone?: string | null;
    tax_identification_number?: string | null;
    vat_rate?: number | null;
    vat_registration_status?: string | null;
  };
  notes?: string;
  order: Record<string, unknown>;
  orderNumber: string;
  orderShippingFee: number;
  orderSubtotal: number;
  orderTotal: number;
  paymentAccount: ReceiptOrder['virtual_account'];
  shippingAddress: OrderCreateInput['shipping_address'];
}): InvoiceData {
  const taxAmount = Number(input.order.tax_amount || 0);
  const discountAmount = Number(input.order.discount_amount || 0);
  const currency =
    typeof input.order.currency === 'string' && input.order.currency
      ? input.order.currency
      : 'NGN';
  const vatCategoryCode =
    input.merchant.vat_registration_status === 'registered' || taxAmount > 0
      ? 'S'
      : 'O';
  const vatRate =
    vatCategoryCode === 'S' ? (input.merchant.vat_rate ?? 7.5) : 0;
  const lineExtensionTotal = input.items.reduce(
    (total, item) => total + getOrderItemLineExtensionAmount(item),
    0
  );
  const hasDeviceItem = input.items.some((item) =>
    isDeviceReceiptItemName(getOrderItemBaseName(item))
  );
  const paymentAccount =
    input.paymentAccount ||
    (input.merchant.bank_account_number
      ? {
          account_number: input.merchant.bank_account_number,
          account_name:
            input.merchant.bank_account_name ||
            input.merchant.business_name ||
            undefined,
          bank_name: input.merchant.bank_name || undefined,
        }
      : null);
  let allocatedTaxAmount = 0;

  const invoiceItems: InvoiceLineItem[] = input.items.map((item, index) => {
    const itemAssuranceFee = getOrderItemAssuranceFee(item);
    const lineExtensionAmount = getOrderItemLineExtensionAmount(item);
    const persistedVatAmount = toFiniteNumber(item.vat_amount);
    const vatAmount =
      persistedVatAmount ??
      allocateLineTax({
        index,
        itemCount: input.items.length,
        lineExtensionAmount,
        lineExtensionTotal,
        taxAmount,
        allocatedTaxAmount,
      });
    allocatedTaxAmount += vatAmount;

    const persistedDescription =
      typeof item.item_description === 'string' &&
      item.item_description.trim().length > 0
        ? item.item_description.trim()
        : undefined;
    const itemDescription = appendReceiptFulfillmentDescription({
      description:
        persistedDescription ??
        getOrderItemVariantLabel(item, { includeConditionFallback: false }) ??
        undefined,
      fulfillment: input.fulfillment,
      hasDeviceItem,
      index,
      itemName: getOrderItemBaseName(item),
    });
    const description = itemAssuranceFee
      ? `${itemDescription ? `${itemDescription} ` : ''}Includes device assurance fee (${currency} ${itemAssuranceFee.toFixed(2)}).`
      : itemDescription;

    return {
      line_id: index + 1,
      product_id: getOrderItemProductId(item),
      name: getOrderItemBaseName(item),
      description,
      quantity: item.quantity,
      unit_code: item.unit_code || 'EA',
      price: getOrderItemUnitPrice(item),
      line_extension_amount: lineExtensionAmount,
      vat_category_code: item.vat_category_code || vatCategoryCode,
      vat_rate: item.vat_rate ?? vatRate,
      vat_amount: vatAmount,
      sellers_item_id: item.sellers_item_id || undefined,
    };
  });
  const taxExclusiveAmount = Math.max(
    0,
    input.orderSubtotal + input.orderShippingFee - discountAmount
  );
  const taxSubtotals: TaxSubtotal[] = [
    {
      vat_category_code: vatCategoryCode,
      vat_rate: vatRate,
      taxable_amount: taxExclusiveAmount,
      tax_amount: taxAmount,
      exemption_reason:
        vatCategoryCode === 'O' ? 'Seller is not VAT registered' : undefined,
    },
  ];
  const issueDate = getImmediateInvoiceIssueDate(input.order);

  return {
    invoice_number: input.orderNumber,
    invoice_type_code: '380',
    issue_date: issueDate,
    due_date: getImmediateInvoiceDueDate(input.order),
    currency,
    buyer_reference: input.customerEmail || input.customerName,
    merchant: {
      business_name: input.merchant.business_name,
      legal_entity_name: input.merchant.legal_entity_name || undefined,
      tax_identification_number:
        input.merchant.tax_identification_number || undefined,
      cac_rc_number: input.merchant.cac_rc_number || undefined,
      vat_registration_status:
        input.merchant.vat_registration_status || 'not_registered',
      vat_rate: input.merchant.vat_rate ?? vatRate,
      registered_address: input.merchant.registered_address || undefined,
      support_email: input.merchant.support_email || undefined,
      support_phone: input.merchant.support_phone || undefined,
      logo_url: input.merchant.logo_url || undefined,
    },
    customer: {
      name: input.customerName,
      email: input.customerEmail || undefined,
      phone: input.customerPhone || undefined,
      address: input.shippingAddress
        ? {
            street: input.shippingAddress.address,
            city: input.shippingAddress.city,
            state: input.shippingAddress.state,
            country: 'NG',
          }
        : undefined,
    },
    items: invoiceItems,
    tax_subtotals: taxSubtotals,
    subtotal: input.orderSubtotal,
    tax_exclusive_amount: taxExclusiveAmount,
    tax_amount: taxAmount,
    tax_inclusive_amount: taxExclusiveAmount + taxAmount,
    shipping_fee: input.orderShippingFee,
    discount_amount: discountAmount,
    total: input.orderTotal,
    amount_paid: Number(input.order.amount_paid || 0),
    notes: input.notes,
    payment_account: paymentAccount
      ? {
          account_number: paymentAccount.account_number,
          account_name: paymentAccount.account_name || undefined,
          bank_name: paymentAccount.bank_name || undefined,
        }
      : undefined,
    firs_irn:
      typeof input.order.firs_irn === 'string'
        ? input.order.firs_irn
        : undefined,
    firs_csid:
      typeof input.order.firs_csid === 'string'
        ? input.order.firs_csid
        : undefined,
  };
}

function invalidQuizVoucherTokenResponse() {
  return NextResponse.json(
    {
      code: 'QUIZ_VOUCHER_TOKEN_INVALID',
      error: 'Invalid quiz voucher token',
    },
    { status: 400 }
  );
}

function invalidQuizVoucherQuantityResponse() {
  return NextResponse.json(
    {
      code: 'QUIZ_VOUCHER_QUANTITY_INVALID',
      error: 'Quiz voucher items must have quantity 1',
    },
    { status: 400 }
  );
}

function getQuizVoucherAwardEvent(row: unknown) {
  if (!row || typeof row !== 'object') return null;
  const joined = (row as { quiz_events?: unknown }).quiz_events;
  const event = Array.isArray(joined) ? joined[0] : joined;
  if (!event || typeof event !== 'object') return null;
  const complianceVerified = (event as { compliance_verified?: unknown })
    .compliance_verified;
  const nlrcPermitRef = (event as { nlrc_permit_ref?: unknown })
    .nlrc_permit_ref;

  return {
    complianceVerified: complianceVerified === true,
    nlrcPermitRef: typeof nlrcPermitRef === 'string' ? nlrcPermitRef : null,
  };
}

// GET /api/orders - Fetch orders for authenticated merchant
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logger.error({ message: 'API: Auth error or no user', error: authError });
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to fetch orders.' },
        { status: 401 }
      );
    }

    // Get merchant record (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      logger.error({
        message: 'API: Merchant not found for user',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Merchant not found for the authenticated user.' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'orders', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Get search params for filtering
    const { searchParams } = new URL(request.url);
    const paymentStatus = searchParams.get('payment_status');
    const shippingStatus = searchParams.get('shipping_status');
    const searchRaw = searchParams.get('search');

    // Sanitize search input
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;

    // Build query
    let query = supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_QUERY)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    if (shippingStatus && shippingStatus !== 'all') {
      query = query.eq('shipping_status', shippingStatus);
    }

    // Search by customer name or order number (with sanitized input)
    if (search?.trim()) {
      const sanitizedPattern = sanitizeLikePattern(search);
      query = query.or(
        `customer_name.ilike.%${sanitizedPattern}%,order_number.ilike.%${sanitizedPattern}%`
      );
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      logger.error({ message: 'Error fetching orders', error: ordersError });
      return NextResponse.json(
        { error: 'Failed to fetch orders from the database.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    logger.error({ message: 'Unexpected error in GET /api/orders', error });
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order from storefront
// CSRF exemption: This endpoint is called by unauthenticated storefront guests during checkout.
// Guest users do not have CSRF tokens. Abuse is mitigated by rate limiting in proxy.ts,
// Zod validates input shape, while the SECURITY DEFINER RPC enforces merchant + item authorization server-side.
export async function POST(request: NextRequest) {
  try {
    // Optional auth: supports web cookies and mobile Bearer tokens, but still
    // allows guest checkout when authentication is absent.
    const auth = await authenticateApiRequest(request);
    const supabase = auth.supabase ?? createClient(await cookies());
    const user = auth.user;
    const json = await request.json();

    // Capture IP and User Agent for enhanced ad tracking (improves Event Match Quality)
    // Use centralized IP resolution logic to prevent spoofing
    const clientIp = getClientIdentifier(request);
    const clientUserAgent = request.headers.get('user-agent') || undefined;

    // Detect privacy region for CCPA/GDPR compliance (LDU flag)
    const geoPrivacy = await detectPrivacyRegion(clientIp);

    const parseResult = orderCreateSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    const {
      merchant_id,
      customer_email,
      customer_name,
      customer_phone,
      items,
      shipping_fee, // Default already handled by Zod
      payment_method,
      payment_status,
      shipping_status,
      shipping_address,
      source,
      notes,
      // Ad tracking data for offline conversions
      ad_tracking,
      // Wallet redemption
      use_wallet_credit,
      wallet_amount,
      use_savings_credit,
      savings_amount,
      savings_goal_id,
      // User ID
      user_id,
    } = body;

    if (user && user_id && user_id !== user.id) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // SECURITY: Only use user_id from authenticated session.
    // Do NOT trust user_id from body if user is unauthenticated (guest).
    const resolvedUserId = user?.id || null;

    const hasVoucherItem = hasQuizVoucherItem(items);
    const requestIdempotencyKey = hasVoucherItem
      ? null
      : getRequestIdempotencyKey(request);
    const verifiedQuizVoucherAwardIdsByIndex = new Map<number, string>();

    // Phase 1b voucher orders are user-bound. Keep the prize path behind the
    // production guard before any order mutation work.
    if (hasVoucherItem) {
      if (!resolvedUserId) {
        return NextResponse.json(
          {
            error: 'Authentication required for quiz voucher orders',
            code: 'QUIZ_VOUCHER_AUTH_REQUIRED',
          },
          { status: 401 }
        );
      }

      if (
        getQuizPhaseEnv() !== 'production' ||
        !getQuizProductionApprovedEnv()
      ) {
        try {
          enforcePrizeProductionGuard({ nlrc_permit_ref: null }, false);
        } catch (error) {
          if (error instanceof QuizProductionNotApprovedError) {
            return NextResponse.json(
              {
                error: 'Quiz vouchers are not approved for production use',
                code: error.code,
              },
              { status: error.status }
            );
          }

          throw error;
        }
      }

      for (const [index, item] of items.entries()) {
        if (!hasQuizVoucherIdentifier(item)) {
          continue;
        }

        if (item.quantity !== 1) {
          return invalidQuizVoucherQuantityResponse();
        }

        const voucherToken = getQuizVoucherToken(item);
        if (!voucherToken) {
          return invalidQuizVoucherTokenResponse();
        }

        const tokenVerification = verifyQuizVoucherToken(voucherToken);
        if (!tokenVerification.ok) {
          if (tokenVerification.error === 'missing_quiz_voucher_secret') {
            return NextResponse.json(
              {
                code: 'QUIZ_VOUCHER_TOKEN_CONFIG_MISSING',
                error: 'Quiz voucher verification is not configured',
              },
              { status: 500 }
            );
          }

          if (tokenVerification.error === 'expired_quiz_voucher_token') {
            return NextResponse.json(
              {
                code: 'QUIZ_VOUCHER_TOKEN_EXPIRED',
                error: 'Quiz voucher token has expired',
              },
              { status: 400 }
            );
          }

          return invalidQuizVoucherTokenResponse();
        }

        const itemProductId = getOrderItemProductId(item);
        const itemVariantId = getOrderItemVariantId(item);
        const itemCondition = getOrderItemCondition(item);
        if (
          tokenVerification.payload.userId !== resolvedUserId ||
          tokenVerification.payload.productId !== itemProductId ||
          tokenVerification.payload.variantId !== itemVariantId ||
          tokenVerification.payload.condition !== itemCondition
        ) {
          return invalidQuizVoucherTokenResponse();
        }

        verifiedQuizVoucherAwardIdsByIndex.set(
          index,
          tokenVerification.payload.awardId
        );
      }

      const voucherAwardIds = [
        ...new Set(verifiedQuizVoucherAwardIdsByIndex.values()),
      ];
      if (voucherAwardIds.length !== 1) {
        return invalidQuizVoucherTokenResponse();
      }

      const { data: voucherAward, error: voucherAwardError } = await supabase
        .from('quiz_awards')
        .select(
          'event_id, quiz_events!inner(nlrc_permit_ref, compliance_verified)'
        )
        .eq('id', voucherAwardIds[0])
        .maybeSingle();
      if (voucherAwardError) {
        logger.error({
          message: 'Quiz voucher award lookup failed',
          error: voucherAwardError,
          voucherAwardId: voucherAwardIds[0],
        });
        return invalidQuizVoucherTokenResponse();
      }

      if (!voucherAward) {
        return invalidQuizVoucherTokenResponse();
      }

      const voucherEvent = getQuizVoucherAwardEvent(voucherAward);
      try {
        enforcePrizeProductionGuard(
          { nlrc_permit_ref: voucherEvent?.nlrcPermitRef ?? null },
          getQuizPhaseEnv() === 'production' &&
            getQuizProductionApprovedEnv() &&
            voucherEvent?.complianceVerified === true
        );
      } catch (error) {
        if (error instanceof QuizProductionNotApprovedError) {
          return NextResponse.json(
            {
              error: 'Quiz vouchers are not approved for production use',
              code: error.code,
            },
            { status: error.status }
          );
        }

        throw error;
      }
    }

    // Fetch merchant to verify it exists (include business_name, slug for email)
    const { data: merchant, error: merchantFetchError } = await supabase
      .from('merchants')
      .select(
        'id, phone, rider_phone_number, business_name, business_address, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number, plan_tier, vat_registration_status, vat_rate, registered_address, support_phone, logo_url, legal_entity_name, brand_colors, bank_code, bank_account_number, bank_name, bank_account_name, social_media, pages'
      )
      .eq('id', merchant_id)
      .single();

    if (merchantFetchError || !merchant) {
      logger.error({
        message: 'Failed to fetch merchant for order creation',
        error: merchantFetchError,
      });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const orderItemsPayload = items.map((item, index) => {
      const hasAssurance = item.has_assurance || false;
      const itemPrice = item.negotiatedPrice ?? item.price;
      const variantName = getOrderItemVariantLabel(item);
      // SECURITY: Recompute assurance_fee server-side — never trust client values (quantity-aware)
      const assuranceFee = hasAssurance
        ? roundCurrency(itemPrice * item.quantity * SERVER_ASSURANCE_RATE)
        : 0;
      const voucherAwardId = verifiedQuizVoucherAwardIdsByIndex.get(index);

      return {
        product_id: getOrderItemProductId(item),
        condition: item.condition,
        image_url: item.imageUrl ?? item.image_url ?? null,
        variant_id: item.variantId || item.variant_id,
        variant_name: variantName,
        variant_attributes:
          item.variantAttributes || item.variant_attributes || {},
        quantity: item.quantity,
        price: itemPrice,
        has_assurance: hasAssurance,
        assurance_fee: assuranceFee,
        ...(voucherAwardId ? { voucher_award_id: voucherAwardId } : {}),
      };
    });

    if (orderItemsPayload.some((item) => !item.product_id)) {
      return NextResponse.json(
        { error: 'Invalid order items' },
        { status: 400 }
      );
    }

    let quizVoucherRouteProof: ReturnType<
      typeof createQuizRpcServerProof
    > | null = null;
    if (hasVoucherItem) {
      if (!resolvedUserId) {
        return NextResponse.json(
          {
            error: 'Authentication required for quiz voucher orders',
            code: 'QUIZ_VOUCHER_AUTH_REQUIRED',
          },
          { status: 401 }
        );
      }

      const voucherAwardIds = [...verifiedQuizVoucherAwardIdsByIndex.values()];
      if (voucherAwardIds.length !== 1) {
        return invalidQuizVoucherTokenResponse();
      }

      quizVoucherRouteProof = createQuizRpcServerProof({
        action: 'create_storefront_order_with_quiz_voucher',
        payload: {
          items: orderItemsPayload.map((item) => ({
            condition: item.condition ?? null,
            product_id: item.product_id,
            quantity: item.quantity,
            variant_id: item.variant_id ?? null,
            voucher_award_id: item.voucher_award_id ?? null,
          })),
          merchant_id,
          user_id: resolvedUserId,
        },
        subjectId: voucherAwardIds[0],
        userId: resolvedUserId,
      });
    }

    const shippingFeeValue = Number.parseFloat(shipping_fee.toString());
    const discountAmountValue = Number.parseFloat(
      (body.discount_amount || 0).toString()
    );
    const taxAmountValue = Number.parseFloat((body.tax_amount || 0).toString());
    // B3.5 (Δ-39): gift_wrapping_fee + tax_basis are now first-class
    // RPC params. Zod defaults gift_wrapping_fee to 0 and tax_basis to
    // 'exclusive', so legacy callers continue to work; VAT-aware
    // storefront callers pass both explicitly.
    const giftWrappingFeeValue = Number.parseFloat(
      (body.gift_wrapping_fee || 0).toString()
    );

    if (
      Number.isNaN(shippingFeeValue) ||
      Number.isNaN(discountAmountValue) ||
      Number.isNaN(taxAmountValue) ||
      Number.isNaN(giftWrappingFeeValue)
    ) {
      return NextResponse.json(
        { error: 'Invalid pricing values' },
        { status: 400 }
      );
    }

    if (discountAmountValue !== 0) {
      return NextResponse.json(
        {
          code: 'discount_amount_not_supported',
          error: 'Failed to create order',
        },
        { status: 400 }
      );
    }

    // Storefront discount code (only codes are trusted; raw discount_amount is
    // still rejected above). Detected early so the negotiation discount can be
    // suppressed when a code is applied (mutually exclusive — code wins).
    const requestedDiscountCode =
      typeof body.discount_code === 'string' &&
      body.discount_code.trim().length > 0
        ? body.discount_code.trim()
        : null;

    // Codex P1 (PR #1622 round 6): the legacy storefront checkout
    // (`apps/web/src/app/checkout/page.tsx`) doesn't send
    // `tax_amount` — Zod defaults to 0 — and that 0 tripped the
    // RPC's `tax_amount_mismatch` guard on every VAT-registered
    // merchant. Same root cause as the agentic dispatch.
    //
    // Recompute the canonical per-line tax server-side here so
    // every caller (legacy checkout, ogabassey checkout,
    // mobile-admin order-create, agentic) lands on a payload that
    // the RPC will accept. The `expected_total` parity guard
    // (Δ-39, Codex round 2) still catches client display drift —
    // it just gets to fire on a correctly-tax'd order rather than
    // being preceded by a confusing `tax_amount_mismatch` 400.
    //
    // The helper uses the caller's standard scoped client. The
    // single RLS-bypassing path (variant override lookup) goes
    // through the `get_order_variant_overrides` SECURITY DEFINER
    // RPC, granted to anon/authenticated/service_role — the trust
    // boundary lives in the database, not the Next.js layer
    // (CodeRabbit High on PR #1622 round 7).
    let serverComputedTaxAmount: number;
    try {
      serverComputedTaxAmount = await computeAgenticOrderTax({
        items: items.map((item) => ({
          product_id: item.product_id || item.productId || item.id,
          quantity: item.quantity,
          variant_id: item.variantId || item.variant_id,
        })),
        merchantId: merchant_id,
        supabase,
      });
    } catch (taxError) {
      // Codex P2 (PR #1622 round 7): malformed item ids (Zod only
      // validates as `string`) cascade into Postgres's UUID parser
      // as code 22P02. Pre-route-side-recompute, the RPC's own
      // 22P02 path got mapped via `clientErrorCodes` to a 400. We
      // must preserve that semantic so bad client payloads don't
      // look like server outages.
      if (isTaxComputeUuidError(taxError)) {
        logger.warn({
          error: taxError,
          merchantId: merchant_id,
          message: 'Storefront order received malformed item identifier',
        });
        // Match the RPC error mapping below (`{ error: 'Failed to
        // create order', details: <stable code> }`) AND share the
        // `invalid_items` identifier with the agentic dispatch's
        // 22P02 path — review findings on PR #1622 round 7.
        return NextResponse.json(
          {
            error: 'Failed to create order',
            details: 'invalid_items',
          },
          { status: 400 }
        );
      }
      logger.error({
        error: taxError,
        merchantId: merchant_id,
        message: 'Storefront order VAT recompute failed',
      });
      return NextResponse.json(
        { code: 'TAX_COMPUTE_FAILED', error: 'Unable to compute order tax' },
        { status: 500 }
      );
    }

    const merchantCanAutoNegotiate = hasPriceNegotiationEntitlement(
      merchant.plan_tier,
      merchant.slug
    );
    const vatRegistered = merchant.vat_registration_status === 'registered';

    // ALWAYS validate per-line client prices — even for non-entitled merchants
    // and callers that omit expected_total. The RPC charges the catalog line
    // price, but it adds the route-recomputed `assurance_fee` (derived from the
    // client line price) into the subtotal, so an unvalidated below-catalog
    // price would leak an uncapped assurance discount. The derived discount is
    // only APPLIED below.
    let negotiationDiscount: Awaited<
      ReturnType<typeof computeOrderNegotiationDiscount>
    >;
    try {
      negotiationDiscount = await computeOrderNegotiationDiscount({
        items: orderItemsPayload,
        merchantId: merchant_id,
        supabase,
        vatRegistered,
      });
    } catch (negotiationDiscountError) {
      if (isCanonicalOrderSubtotalUuidError(negotiationDiscountError)) {
        logger.warn({
          error: negotiationDiscountError,
          merchantId: merchant_id,
          message:
            'Storefront order received malformed identifier during negotiation discount lookup',
        });
        return NextResponse.json(
          { error: 'Failed to create order', details: 'invalid_items' },
          { status: 400 }
        );
      }
      logger.error({
        error: negotiationDiscountError,
        merchantId: merchant_id,
        message: 'Storefront order negotiation discount recompute failed',
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Reject tampered lines before any side effects (non-negotiable below
    // catalog, or negotiable > 2% below catalog), regardless of entitlement /
    // expected_total.
    if (negotiationDiscount?.rejectionCode) {
      return NextResponse.json(
        {
          error: 'Failed to create order',
          details: negotiationDiscount.rejectionCode,
        },
        { status: 400 }
      );
    }

    // Apply the derived discount for entitled merchants when either:
    // - the caller supplied an expected_total for RPC parity, or
    // - the mobile storefront omitted expected_total until it can use the same
    //   per-line/catalog VAT source as this route. The per-line discount is
    //   still server-validated and capped before this point; this branch only
    //   decides whether the validated discount should be charged.
    const shouldApplyServerDerivedDiscount =
      merchantCanAutoNegotiate &&
      !requestedDiscountCode &&
      (typeof body.expected_total === 'number' || source === 'mobile_app');
    const serverDerivedDiscountAmount = shouldApplyServerDerivedDiscount
      ? (negotiationDiscount?.totalDiscount ?? 0)
      : 0;

    const adTrackingPayload = ad_tracking
      ? {
          ...ad_tracking,
          userIp: clientIp || ad_tracking.userIp,
          userAgent: clientUserAgent || ad_tracking.userAgent,
          limitedDataUse:
            geoPrivacy.shouldApplyLDU || ad_tracking.limitedDataUse,
          geoCountry: geoPrivacy.country,
          geoRegion: geoPrivacy.region,
        }
      : clientIp || clientUserAgent || geoPrivacy.shouldApplyLDU
        ? {
            userIp: clientIp,
            userAgent: clientUserAgent,
            limitedDataUse: geoPrivacy.shouldApplyLDU,
            geoCountry: geoPrivacy.country,
            geoRegion: geoPrivacy.region,
          }
        : null;

    const resolvedShippingProvider = body.shipping_provider ?? null;
    const resolvedTrackingNumber = body.tracking_number ?? null;
    let shippingAddressForOrder: OrderCreateInput['shipping_address'];
    try {
      shippingAddressForOrder = await enrichShippingAddressWithQuoteDestination(
        supabase,
        body.selected_quote_id,
        shipping_address
      );
    } catch (error) {
      if (error instanceof OrderQuoteDestinationMismatchError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        );
      }
      throw error;
    }

    const payOnDelivery = isPayOnDelivery(payment_method);

    let effectivePaymentStatus = payment_status;
    if (payOnDelivery) {
      effectivePaymentStatus = 'pending';

      if (merchant?.rider_phone_number) {
        logger.info({
          message: 'Rider Notification Triggered (POD)',
          riderPhone: merchant.rider_phone_number,
          customerName: customer_name,
          customerAddress: shippingAddressForOrder?.address,
        });
      } else {
        logger.warn({
          message: 'Rider Notification Skipped (No Phone Number)',
          merchantId: merchant_id,
        });
      }
    }

    // Hoisted above the idempotency hash so both the discount-code combination
    // guard and the hash can reference it.
    const requestedSavingsRedemption =
      use_savings_credit &&
      savings_goal_id &&
      typeof savings_amount === 'number' &&
      savings_amount > 0;

    // Resolve + validate the discount code server-side, then compute the amount
    // from the CANONICAL subtotal (never the client cart total). Eligibility /
    // targeting is enforced authoritatively + replay-safely in the wrapper RPC.
    let discountCodeId: string | null = null;
    let discountCodeAmount = 0;
    if (requestedDiscountCode) {
      if (hasVoucherItem) {
        return NextResponse.json(
          {
            code: 'DISCOUNT_CODE_VOUCHER_COMBINATION_UNSUPPORTED',
            error: 'Failed to create order',
          },
          { status: 400 }
        );
      }
      if (requestedSavingsRedemption) {
        return NextResponse.json(
          {
            code: 'DISCOUNT_CODE_SAVINGS_COMBINATION_UNSUPPORTED',
            error: 'Failed to create order',
          },
          { status: 400 }
        );
      }

      // include_inactive=true: resolve even a deactivated code so a retry can
      // reach the replay-aware wrapper; the wrapper decides replay vs a fresh
      // `code_inactive` rejection.
      const { data: discountRows, error: discountLookupError } =
        await supabase.rpc('get_storefront_discount_code', {
          p_merchant_id: merchant_id,
          p_code: requestedDiscountCode,
          p_include_inactive: true,
        });
      if (discountLookupError) {
        // Don't mask a server/DB failure as an invalid-code 400.
        logger.error({
          message: 'Discount code lookup failed',
          error: discountLookupError,
          merchantId: merchant_id,
        });
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
      const parsedDiscountArray = storefrontDiscountCodeRowSchema
        .array()
        .safeParse(discountRows);
      const parsedDiscountSingle = parsedDiscountArray.success
        ? null
        : storefrontDiscountCodeRowSchema.safeParse(discountRows);
      const discountRow = parsedDiscountArray.success
        ? (parsedDiscountArray.data[0] ?? null)
        : parsedDiscountSingle?.success
          ? parsedDiscountSingle.data
          : null;
      if (!discountRow) {
        return NextResponse.json(
          { code: 'discount_code_invalid', error: 'Invalid discount code' },
          { status: 400 }
        );
      }
      discountCodeId = discountRow.id;

      let discountCanonicalSubtotal: number | null;
      try {
        discountCanonicalSubtotal = await computeCanonicalOrderSubtotal({
          items: orderItemsPayload,
          merchantId: merchant_id,
          supabase,
        });
      } catch (subtotalError) {
        if (isCanonicalOrderSubtotalUuidError(subtotalError)) {
          return NextResponse.json(
            { error: 'Failed to create order', details: 'invalid_items' },
            { status: 400 }
          );
        }
        logger.error({
          error: subtotalError,
          merchantId: merchant_id,
          message: 'Discount canonical subtotal recompute failed',
        });
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
      if (discountCanonicalSubtotal == null) {
        return NextResponse.json(
          { error: 'Failed to create order', details: 'invalid_items' },
          { status: 400 }
        );
      }

      discountCodeAmount = computeDiscountAmountForSubtotal(
        {
          discount_type:
            discountRow.discount_type === 'fixed_amount'
              ? 'fixed'
              : 'percentage',
          discount_value: Number(discountRow.discount_value),
          maximum_discount_amount: discountRow.maximum_discount_amount,
        },
        discountCanonicalSubtotal
      );
    }

    const checkoutRequestHash = requestIdempotencyKey
      ? hashOrderIdempotencyPayload(
          buildOrderIdempotencyPayload({
            ...body,
            shipping_address: shippingAddressForOrder,
            // STABLE code identity, NOT the recomputed amount, so a merchant
            // editing the code between a checkout and its retry can't trip
            // checkout_idempotency_conflict before the wrapper's replay path.
            discount_amount: discountCodeId ? 0 : serverDerivedDiscountAmount,
            discount_code: requestedDiscountCode,
            gift_wrapping_fee: giftWrappingFeeValue,
            items: orderItemsPayload,
            shipping_fee: shippingFeeValue,
            tax_amount: serverComputedTaxAmount,
          })
        )
      : null;

    const savingsRedemptionIdempotencyKey = requestedSavingsRedemption
      ? getSavingsRedemptionIdempotencyKey({
          customerEmail: customer_email,
          items: orderItemsPayload.map((item) => ({
            product_id: item.product_id ?? '',
            quantity: item.quantity,
            variant_id: item.variant_id ?? null,
          })),
          merchantId: merchant_id,
          requestIdempotencyKey,
          savingsAmount: savings_amount,
          savingsGoalId: savings_goal_id,
        })
      : null;

    if (requestedSavingsRedemption && hasVoucherItem) {
      return NextResponse.json(
        {
          code: 'SAVINGS_VOUCHER_COMBINATION_UNSUPPORTED',
          error: 'Savings cannot be combined with quiz voucher orders',
        },
        { status: 400 }
      );
    }

    const orderRpcArgs = {
      p_merchant_id: merchant_id,
      p_customer_email: customer_email,
      p_customer_name: customer_name,
      p_customer_phone: customer_phone || null,
      p_items: orderItemsPayload,
      p_shipping_fee: shippingFeeValue,
      p_discount_amount: discountCodeId
        ? discountCodeAmount
        : serverDerivedDiscountAmount,
      p_tax_amount: serverComputedTaxAmount,
      p_payment_method: payment_method,
      p_payment_status: effectivePaymentStatus,
      p_shipping_status: shipping_status,
      p_shipping_address: shippingAddressForOrder || null,
      p_source: source,
      p_notes: notes || null,
      p_ad_tracking: adTrackingPayload,
      p_selected_quote_id: body.selected_quote_id || null,
      p_shipping_provider: resolvedShippingProvider,
      p_tracking_number: resolvedTrackingNumber || null,
      p_user_id: resolvedUserId,
      // Server-computed tax — replaces the client-supplied value
      // so legacy callers without `tax_amount` succeed and
      // storefront callers can't fake a wrong-but-matching value
      // (Codex P1 round 6).
      // B3.5 (Δ-42, Δ-47): tax_basis + gift_wrapping_fee. The RPC
      // enforces VAT itself for VAT-registered merchants and also
      // runs a client/server total parity check (Codex P1) against
      // p_expected_total BEFORE any side effects, so a mismatch
      // rolls back atomically — no orphan order, no stock leak.
      //
      // Codex P1 round 6 (PR #1622): `tax_basis` is SERVER-controlled
      // policy, NOT caller input. The RPC itself overrides
      // `v_tax_basis := 'exclusive'` after enum validation
      // (`create_storefront_order` is GRANT'd to anon via PostgREST,
      // so the trust boundary has to live IN the function — see
      // the `Codex P1 round 6 ii` comment in
      // `20260512200000_storefront_order_vat_enforcement.sql`).
      // This API-level hardcode is defense-in-depth — any caller
      // routing through /api/orders also gets the right value
      // without relying on PostgREST RLS / RPC behavior.
      p_tax_basis: 'exclusive',
      p_gift_wrapping_fee: giftWrappingFeeValue,
      p_expected_total:
        typeof body.expected_total === 'number' ? body.expected_total : null,
      ...(quizVoucherRouteProof
        ? { p_route_proof: quizVoucherRouteProof }
        : {}),
      ...(requestIdempotencyKey && checkoutRequestHash
        ? {
            p_checkout_idempotency_key: requestIdempotencyKey,
            p_checkout_request_hash: checkoutRequestHash,
          }
        : {}),
    };

    const orderCreateRpcName = requestedSavingsRedemption
      ? 'create_storefront_order_with_savings'
      : hasVoucherItem
        ? 'create_storefront_order_with_quiz_voucher'
        : discountCodeId
          ? 'create_storefront_order_with_discount_code'
          : 'create_storefront_order';

    const orderCreateRpcArgs = requestedSavingsRedemption
      ? {
          ...orderRpcArgs,
          p_savings_amount: savings_amount,
          p_savings_goal_id: savings_goal_id,
          p_savings_idempotency_key: savingsRedemptionIdempotencyKey,
        }
      : discountCodeId
        ? { ...orderRpcArgs, p_discount_code_id: discountCodeId }
        : orderRpcArgs;

    const { data: orderRows, error: orderError } = await supabase.rpc(
      orderCreateRpcName,
      orderCreateRpcArgs
    );

    const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;

    if (orderError || !order) {
      const code =
        typeof orderError?.code === 'string' ? orderError.code : null;
      const message =
        typeof orderError?.message === 'string'
          ? orderError.message
          : code || 'Failed to create order';
      if (
        requestedSavingsRedemption &&
        (message.includes('savings_') || code === '22023' || code === '42501')
      ) {
        return NextResponse.json(
          { code: code ?? 'SAVINGS_REDEMPTION_FAILED', error: message },
          {
            status:
              code === '22023' ||
              code === '42501' ||
              message.includes('not_authorized')
                ? 400
                : 409,
          }
        );
      }
      if (message === 'checkout_idempotency_conflict') {
        return NextResponse.json(
          {
            code: 'CHECKOUT_IDEMPOTENCY_CONFLICT',
            error:
              'This checkout request was already used for a different cart, customer, or delivery payload.',
          },
          { status: 409 }
        );
      }
      if (message === 'order_not_reusable') {
        return NextResponse.json(
          {
            code: 'CHECKOUT_ORDER_NOT_REUSABLE',
            error:
              'This checkout order can no longer be reused. Refresh checkout and start a new order.',
          },
          { status: 409 }
        );
      }
      // Discount-code limit outcomes are race/state conflicts, not malformed
      // input — surface as 409 so the client shows "no longer available".
      if (
        message === 'usage_limit_reached' ||
        message === 'per_customer_limit_reached'
      ) {
        return NextResponse.json(
          { code: message, error: 'Discount code is no longer available' },
          { status: 409 }
        );
      }
      const clientErrorCodes = [
        'invalid_items',
        'invalid_quantity',
        'invalid_variant',
        'insufficient_stock',
        'insufficient_variant_stock',
        'merchant_not_found',
        'customer_email_required',
        'customer_name_required',
        'items_required',
        'user_id_mismatch',
        'invalid_payment_status',
        'discount_amount_not_supported',
        // Discount-code redemption client errors (→ 400). The wrapper RPC
        // raises these for fresh orders; safe for the client to fix and retry.
        'discount_code_required',
        'discount_code_not_found',
        'discount_code_invalid',
        'discount_code_not_eligible',
        'code_inactive',
        'code_not_started',
        'code_expired',
        'minimum_purchase_not_met',
        'discount_amount_mismatch',
        // B3 (plan §5 B3): RPC raises when shipping_provider is set
        // without a quote id. Map to 4xx so the client gets the right
        // re-quote signal instead of a generic 500.
        'shipping_quote_required',
        // B3.5 (Δ-42, Δ-47): RPC raises when the client-supplied
        // VAT/total/gift-wrap inputs violate merchant VAT config.
        // All client-side input errors → 400 so the storefront can
        // re-quote / re-render the order summary cleanly instead of
        // bouncing the user with a generic 500.
        'invalid_tax_basis',
        'tax_amount_mismatch',
        'tax_amount_must_be_zero_for_non_vat_merchant',
        'quiz_voucher_invalid',
        'quiz_voucher_user_required',
        'quiz_voucher_award_not_found',
        'quiz_voucher_award_not_approved',
        'quiz_voucher_award_invalid_type',
        'quiz_voucher_order_item_not_found',
        'gift_wrapping_fee_negative',
        // B3.5 (Codex P1 — PR #1622): RPC RAISES this when the
        // client-supplied `p_expected_total` differs from the
        // server-computed total by > ₦1. The RAISE happens BEFORE
        // any side effects so the transaction rolls back cleanly
        // — safe for client to fix and retry.
        'order_total_mismatch',
        '22P02', // PostgreSQL: Invalid text representation (e.g. invalid UUID format)
      ];
      // create_storefront_order should return { message, code } for client errors.
      const isClientError =
        (code ? clientErrorCodes.includes(code) : false) ||
        clientErrorCodes.includes(message);
      if (isClientError) {
        logger.warn({
          message: 'Storefront order rejected by client-side validation',
          error: orderError,
        });
      } else {
        logger.error({ message: 'Error creating order', error: orderError });
      }
      return NextResponse.json(
        { error: 'Failed to create order', details: message },
        { status: isClientError ? 400 : 500 }
      );
    }

    const idempotencyReplayed =
      typeof order === 'object' &&
      order !== null &&
      'idempotency_replayed' in order &&
      order.idempotency_replayed === true;
    const orderTotal = Number(order.total ?? 0);
    const orderSubtotal = Number(order.subtotal ?? 0);
    const orderShippingFee = Number(order.shipping_fee ?? shippingFeeValue);
    const customer_id = order.customer_id || null;
    const orderNum = order.order_number || order.id.slice(0, 8).toUpperCase();

    // === WALLET REDEMPTION (2025 Best Practice: Auto-apply at checkout) ===
    // Process wallet credit redemption atomically after order creation
    let walletRedemptionResult: {
      success: boolean;
      amountRedeemed: number;
      newBalance: number;
      transactionId: string | null;
    } | null = null;
    let savingsRedemptionResult: {
      success: boolean;
      amountRedeemed: number;
      goalId: string;
      redemptionId: string | null;
    } | null = null;

    if (requestedSavingsRedemption) {
      const savingsOrder = order as Record<string, unknown>;
      if (savingsOrder.savings_redemption_success === true) {
        savingsRedemptionResult = {
          success: true,
          amountRedeemed: Number(savingsOrder.savings_redeemed_amount),
          goalId: String(savingsOrder.savings_goal_id ?? savings_goal_id),
          redemptionId:
            typeof savingsOrder.savings_redemption_id === 'string'
              ? savingsOrder.savings_redemption_id
              : null,
        };
      } else {
        logger.error({
          message: 'Savings redemption failed after order RPC',
          orderId: order.id,
          orderNumber: order.order_number,
          customerId: customer_id,
          merchantId: merchant_id,
          savingsGoalId: savings_goal_id,
          requestedSavingsAmount: savings_amount,
          savingsRedemptionSuccess: savingsOrder.savings_redemption_success,
        });
        return NextResponse.json(
          {
            code: 'SAVINGS_REDEMPTION_FAILED',
            error: 'Savings redemption failed',
          },
          { status: 409 }
        );
      }
    }

    const savingsAmountUsed = savingsRedemptionResult?.amountRedeemed || 0;
    const remainingAfterSavings = Math.max(orderTotal - savingsAmountUsed, 0);

    if (
      use_wallet_credit &&
      wallet_amount > 0 &&
      customer_id &&
      remainingAfterSavings > 0
    ) {
      try {
        // Call atomic wallet redemption function (handles idempotency via order_id)
        const { data: redemptionData, error: redemptionError } =
          await supabase.rpc('redeem_wallet_for_order', {
            p_customer_id: customer_id,
            p_merchant_id: merchant_id,
            p_order_id: order.id,
            p_amount: Math.min(wallet_amount, remainingAfterSavings), // Can't redeem more than residual total
            p_order_reference: order.order_number || order.id,
          });

        if (redemptionError) {
          // Log but don't fail order - wallet redemption is optional
          logger.error({
            message: 'Wallet redemption failed',
            error: redemptionError,
            orderId: order.id,
            customerId: customer_id,
            requestedAmount: wallet_amount,
          });
        } else if (redemptionData?.[0]) {
          const result = redemptionData[0];
          if (result.success) {
            walletRedemptionResult = {
              success: true,
              amountRedeemed: Number(result.redeemed_amount),
              newBalance: Number(result.new_balance),
              transactionId: result.transaction_id,
            };

            logger.info({
              message: 'Wallet redemption successful',
              orderId: order.id,
              customerId: customer_id,
              amountRedeemed: result.redeemed_amount,
              newBalance: result.new_balance,
            });
          } else {
            logger.warn({
              message: 'Wallet redemption returned unsuccessful',
              orderId: order.id,
              customerId: customer_id,
              result,
            });
          }
        }
      } catch (walletError) {
        logger.error({
          message: 'Wallet redemption exception',
          error: walletError,
          orderId: order.id,
        });
      }
    }

    // Calculate amount due to payment gateway (total - wallet credit used)
    const walletAmountUsed = walletRedemptionResult?.amountRedeemed || 0;
    const amountDueToGateway =
      orderTotal - savingsAmountUsed - walletAmountUsed;
    let walletFinalized = false;
    let storeCreditFinalized = false;

    // If wallet fully covers the order, mark as paid immediately (2025 best practice)
    if (
      savingsAmountUsed === 0 &&
      walletAmountUsed > 0 &&
      amountDueToGateway <= 0
    ) {
      const { error: walletFinalizeError } = await supabase.rpc(
        'finalize_wallet_order_payment',
        {
          p_order_id: order.id,
          p_amount: walletAmountUsed,
        }
      );

      if (walletFinalizeError) {
        logger.error({
          message: 'Failed to finalize wallet payment',
          error: walletFinalizeError,
          orderId: order.id,
        });
      } else {
        walletFinalized = true;
        logger.info({
          message: 'Order fully paid with wallet credit',
          orderId: order.id,
          walletAmountUsed,
        });
      }
    }

    if (savingsAmountUsed > 0 && amountDueToGateway <= 0) {
      const paymentMethod = walletAmountUsed > 0 ? 'store_credit' : 'savings';
      const { error: storeCreditFinalizeError } = await supabase.rpc(
        'finalize_store_credit_order_payment',
        {
          p_amount: savingsAmountUsed + walletAmountUsed,
          p_order_id: order.id,
          p_payment_method: paymentMethod,
        }
      );

      if (storeCreditFinalizeError) {
        const message =
          typeof storeCreditFinalizeError.message === 'string'
            ? storeCreditFinalizeError.message
            : 'Savings/store-credit payment finalization failed';
        logger.error({
          message: 'Failed to finalize savings/store-credit payment',
          error: storeCreditFinalizeError,
          orderId: order.id,
        });
        return NextResponse.json(
          {
            code: 'STORE_CREDIT_FINALIZE_FAILED',
            error: message,
            orderId: order.id,
          },
          { status: 409 }
        );
      }

      storeCreditFinalized = true;
      logger.info({
        message: 'Order fully paid with savings/store credit',
        orderId: order.id,
        savingsAmountUsed,
        walletAmountUsed,
      });
    }

    // NOTE: Order confirmation email is NOT sent here at order creation.
    // It is sent ONLY after payment is confirmed via webhook handlers:
    // - /api/payments/webhook/route.ts (for Paystack/Korapay)
    // - /api/payments/juicyway/webhook/route.ts (for Juicyway)
    // This prevents sending confirmation emails for abandoned/unpaid orders.
    //
    // Exceptions (send immediately, but fire-and-forget via after()):
    // - POD (Pay on Delivery) or Invoice: no payment gateway redirect
    // - Wallet-paid orders: payment already confirmed via wallet redemption
    //
    // after() runs after the response is sent — email/push never block the response.
    const isWalletFullyPaid = walletFinalized || storeCreditFinalized;
    const shouldSendImmediateOrderNotifications =
      !idempotencyReplayed &&
      (payOnDelivery || payment_method === 'invoice' || isWalletFullyPaid);
    if (shouldSendImmediateOrderNotifications) {
      if (merchant.business_name && merchant.slug) {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
        const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

        const emailItems = items.map((item: EmailOrderItem) => ({
          name: (() => {
            const baseName = item.name || item.productName || 'Product';
            const variantLabel = formatVariantAttributesLabel(
              (
                item as EmailOrderItem & {
                  variantAttributes?: Record<string, string>;
                  variant_attributes?: Record<string, string>;
                }
              ).variantAttributes ||
                (
                  item as EmailOrderItem & {
                    variantAttributes?: Record<string, string>;
                    variant_attributes?: Record<string, string>;
                  }
                ).variant_attributes
            );
            return variantLabel ? `${baseName} (${variantLabel})` : baseName;
          })(),
          quantity: item.quantity || 1,
          price: item.price || 0,
        }));

        const paymentLink = `${merchantUrl}/checkout/resume/${order.id}`;

        const emailData = {
          orderNumber: orderNum,
          customerName: customer_name,
          items: emailItems,
          subtotal: orderSubtotal,
          shippingFee: orderShippingFee,
          total: orderTotal,
          shippingAddress: {
            address: shippingAddressForOrder?.address || '',
            city: shippingAddressForOrder?.city || '',
            state: shippingAddressForOrder?.state || '',
            phone: customer_phone || '',
          },
          merchantName: merchant.business_name,
          merchantUrl,
          merchantTin: merchant.tax_identification_number ?? undefined,
          merchantRcNumber: merchant.cac_rc_number ?? undefined,
          paymentMethod: payment_method,
          paymentLink,
        };

        const htmlContent = generateOrderConfirmationEmail(emailData);
        const textContent = generateOrderConfirmationText(emailData);

        const replyToEmail =
          merchant.support_email ||
          merchant.email ||
          `support@${merchant.slug}.${rootDomain}`;
        const senderName = merchant.email_sender_name
          ? `${merchant.email_sender_name} Orders`
          : merchant.business_name
            ? `${merchant.business_name} Orders`
            : undefined;

        // Fire-and-forget: send email after response is delivered so slow/failing
        // ZeptoMail calls never block or time out the order creation response.
        after(async () => {
          try {
            let attachments:
              | Array<{ name: string; content: string; mime_type: string }>
              | undefined;
            let backgroundSupabase: ReturnType<
              typeof createAdminClient
            > | null = null;

            if (payment_method === 'invoice') {
              try {
                // Auto-generate Dedicated Virtual Account (DVA) for automatic confirmation
                const nameParts = (customer_name || 'Customer')
                  .trim()
                  .split(' ');
                const firstName = nameParts[0] || 'Customer';
                const lastName = nameParts.slice(1).join(' ') || 'User';
                let invoiceVirtualAccount: ReceiptOrder['virtual_account'] =
                  null;
                const invoiceTimingOrder = {
                  ...(order as Record<string, unknown>),
                  created_at:
                    typeof order.created_at === 'string'
                      ? order.created_at
                      : new Date().toISOString(),
                };
                const invoiceDueDate =
                  getImmediateInvoiceDueDate(invoiceTimingOrder);

                // The customer can send display-only item names/prices, while
                // the storefront order RPC persists canonical product/variant
                // snapshots. Render invoice artifacts from those persisted
                // rows after the validated order exists.
                backgroundSupabase ??= createAdminClient();
                const persistedInvoiceItems =
                  await loadPersistedInvoiceOrderItems({
                    orderId: order.id,
                    supabase: backgroundSupabase,
                  });
                if (!persistedInvoiceItems) {
                  logger.error({
                    message:
                      'Persisted order items unavailable for invoice email; skipping non-canonical invoice artifacts',
                    orderId: order.id,
                  });
                  throw new Error('PERSISTED_INVOICE_ITEMS_UNAVAILABLE');
                }
                const invoiceItems = persistedInvoiceItems;

                const dvaResult = await generatePaymentAccount({
                  email: customer_email || `${order.id}@orders.usebaci.com`,
                  firstName,
                  lastName,
                  phone: customer_phone || merchant.phone || '08000000000',
                  orderId: order.id,
                });

                if (dvaResult.success) {
                  const generatedVirtualAccount = {
                    account_number: dvaResult.data.account_number,
                    bank_name: dvaResult.data.bank_name,
                    account_name: dvaResult.data.account_name,
                  };

                  // System-owned DVA/reminder records are written after the
                  // validated order exists; customers do not own these tables
                  // through RLS, so the server-only admin client is scoped to
                  // this post-response side effect and order.id.
                  backgroundSupabase ??= createAdminClient();
                  const dvaExpiresAt = invoiceDueDate.toISOString();
                  const { error: insertError } = await backgroundSupabase
                    .from('order_payment_accounts')
                    .upsert(
                      {
                        order_id: order.id,
                        account_number: dvaResult.data.account_number,
                        bank_name: dvaResult.data.bank_name,
                        account_name: dvaResult.data.account_name,
                        provider: 'paystack',
                        expires_at: dvaExpiresAt,
                      },
                      { onConflict: 'order_id,provider' }
                    );

                  if (insertError) {
                    logger.error({
                      message: 'Failed to store auto-generated invoice DVA',
                      orderId: order.id,
                      error: insertError,
                    });
                  } else {
                    invoiceVirtualAccount = generatedVirtualAccount;
                    logger.info({
                      message: 'Stored auto-generated invoice DVA successfully',
                      orderId: order.id,
                      accountNumber: dvaResult.data.account_number,
                    });
                  }
                } else {
                  logger.error({
                    message: 'Auto-generation of invoice DVA failed',
                    orderId: order.id,
                    error: dvaResult.error,
                  });
                }

                const fulfillment = getOrderFulfillmentDetails(
                  order as Record<string, unknown>
                );
                const hasDeviceItem = invoiceItems.some((item) =>
                  isDeviceReceiptItemName(getOrderItemBaseName(item))
                );
                const amountPaid = Math.max(
                  Number(order.amount_paid || 0),
                  savingsAmountUsed + walletAmountUsed
                );
                const invoiceOrder = {
                  ...invoiceTimingOrder,
                  amount_paid: amountPaid,
                };
                const receiptOrder: ReceiptOrder = {
                  order_number: orderNum,
                  created_at: String(
                    order.created_at || new Date().toISOString()
                  ),
                  currency: order.currency || 'NGN',
                  total: orderTotal,
                  subtotal: orderSubtotal,
                  shipping_fee: orderShippingFee,
                  tax_amount: Number(order.tax_amount || 0),
                  discount_amount: Number(order.discount_amount || 0),
                  amount_paid: amountPaid,
                  balance: Math.max(orderTotal - amountPaid, 0),
                  payment_status: order.payment_status || payment_status,
                  payment_method,
                  is_credit_order: Boolean(
                    (order as Record<string, unknown>).is_credit_order
                  ),
                  customer_name,
                  customer_email,
                  customer_phone: customer_phone || null,
                  shipping_address: buildImmediateInvoiceShippingAddress(
                    shippingAddressForOrder
                  ),
                  virtual_account: invoiceVirtualAccount,
                  fulfillment_details: fulfillment,
                  items: invoiceItems.map((item, index) => {
                    const variantName = getOrderItemVariantLabel(item);

                    return {
                      line_id: index + 1,
                      product_id: item.product_id || null,
                      product_name: getOrderItemBaseName(item),
                      variant_id: item.variant_id || null,
                      variant_name: variantName || undefined,
                      description: appendReceiptFulfillmentDescription({
                        description: undefined,
                        fulfillment,
                        hasDeviceItem,
                        index,
                        itemName: getOrderItemBaseName(item),
                      }),
                      quantity: item.quantity,
                      price: item.negotiatedPrice ?? item.price,
                    };
                  }),
                  transactions: [],
                };
                const receiptMerchant = buildImmediateInvoiceMerchant(merchant);
                const peppolInvoiceData = buildImmediatePeppolInvoiceData({
                  customerEmail: customer_email,
                  customerName: customer_name,
                  customerPhone: customer_phone,
                  fulfillment,
                  items: invoiceItems,
                  merchant,
                  notes,
                  order: invoiceOrder,
                  orderNumber: orderNum,
                  orderShippingFee,
                  orderSubtotal,
                  orderTotal,
                  paymentAccount: invoiceVirtualAccount,
                  shippingAddress: shippingAddressForOrder,
                });
                let peppolInvoiceXml: string | null = null;

                try {
                  peppolInvoiceXml =
                    generatePeppolInvoiceXml(peppolInvoiceData);
                } catch (peppolError) {
                  logger.error({
                    message: 'Failed to generate Peppol UBL invoice XML',
                    orderId: order.id,
                    orderNumber: orderNum,
                    error: peppolError,
                  });
                }

                let logoDataUri: string | null = null;
                try {
                  logoDataUri =
                    await resolveReceiptLogoDataUri(receiptMerchant);
                } catch (logoError) {
                  logger.warn({
                    message:
                      'Failed to resolve invoice logo; using fallback PDF branding',
                    orderId: order.id,
                    orderNumber: orderNum,
                    error: logoError,
                  });
                }

                const invoiceReceiptOrder: ReceiptOrder = {
                  ...receiptOrder,
                  items: mergeReceiptItemsWithInvoiceMetadata(
                    receiptOrder.items,
                    peppolInvoiceData.items
                  ),
                };
                const pdfBlob = generateReceiptBlob(
                  invoiceReceiptOrder,
                  receiptMerchant,
                  {
                    buyerReference: peppolInvoiceData.buyer_reference,
                    complianceNote: peppolInvoiceXml
                      ? PEPPOL_BIS_BILLING_COMPLIANCE_NOTE
                      : undefined,
                    documentDate: peppolInvoiceData.issue_date,
                    documentKind: 'invoice',
                    dueDate: peppolInvoiceData.due_date,
                    firsCsid: peppolInvoiceData.firs_csid,
                    firsIrn: peppolInvoiceData.firs_irn,
                    invoiceTypeCode: peppolInvoiceData.invoice_type_code,
                    invoiceNotes: peppolInvoiceData.notes,
                    logoDataUri,
                    paymentTerms: peppolInvoiceData.payment_terms,
                    taxSubtotals: peppolInvoiceData.tax_subtotals,
                  }
                );
                const arrayBuffer = await pdfBlob.arrayBuffer();
                const base64Content =
                  Buffer.from(arrayBuffer).toString('base64');

                attachments = [
                  {
                    name: `invoice-${orderNum}.pdf`,
                    content: base64Content,
                    mime_type: 'application/pdf',
                  },
                ];

                if (peppolInvoiceXml) {
                  attachments.push({
                    name: `invoice-${orderNum}.xml`,
                    content: Buffer.from(peppolInvoiceXml, 'utf8').toString(
                      'base64'
                    ),
                    mime_type: 'application/xml',
                  });
                }

                // Log standard initial reminder row in order_reminders
                backgroundSupabase ??= createAdminClient();
                const { error: reminderInsertError } = await backgroundSupabase
                  .from('order_reminders')
                  .insert({
                    order_id: order.id,
                    channel: 'email',
                    payment_link: paymentLink,
                  });

                if (reminderInsertError) {
                  logger.error({
                    message: 'Failed to store initial invoice reminder',
                    orderId: order.id,
                    paymentLink,
                    error: reminderInsertError,
                  });
                } else {
                  logger.info({
                    message: 'Stored initial invoice reminder successfully',
                    orderId: order.id,
                    paymentLink,
                  });
                }

                logger.info({
                  message:
                    'Generated branded invoice PDF and logged initial reminder',
                  orderId: order.id,
                  orderNumber: orderNum,
                });
              } catch (err) {
                logger.error({
                  message:
                    'Failed to generate invoice PDF or log initial reminder',
                  orderId: order.id,
                  error: err,
                });
              }
            }

            const emailResult = await sendEmail({
              to: customer_email,
              toName: customer_name,
              subject:
                payment_method === 'invoice'
                  ? `Invoice Generated - #${emailData.orderNumber}`
                  : `Order Confirmation - #${emailData.orderNumber}`,
              htmlContent,
              textContent,
              replyTo: replyToEmail,
              emailType: 'orders',
              fromName: senderName,
              attachments,
              auditContext: {
                merchantId: merchant_id,
                orderId: order.id,
                customerId: customer_id,
                metadata: {
                  trigger: 'order_create_immediate_confirmation',
                  paymentMethod: payment_method,
                },
              },
            });

            if (!emailResult.success) {
              logger.error({
                message: 'Failed to send order confirmation email',
                orderId: order.id,
                paymentMethod: payment_method,
                emailError: emailResult.error,
                emailErrorCode: emailResult.errorCode,
                emailErrorDetails: emailResult.errorDetails,
              });
            } else {
              logger.info({
                message: 'Order confirmation email sent',
                orderId: order.id,
                paymentMethod: payment_method,
                messageId: emailResult.messageId,
              });
            }
          } catch (emailError) {
            logger.error({
              message: 'Error sending order confirmation email',
              error: emailError,
            });
          }
        });
      }

      // Notify merchant of new order — fire-and-forget via after() for the same reason.
      after(async () => {
        if (!shouldSendImmediateOrderNotifications) {
          // Card/Paystack payments trigger notifyNewOrder from the webhook/payment-verify handler
          // upon successful payment callback to prevent premature/duplicate notifications.
          return;
        }

        try {
          const pushResult = await notifyNewOrder(
            merchant_id,
            order.id,
            orderNum,
            customer_name,
            orderTotal,
            order.currency || 'NGN'
          );
          if (pushResult.failed > 0 || pushResult.errors.length > 0) {
            logger.warn({
              message: 'New order push notification was not fully delivered',
              orderId: order.id,
              merchantId: merchant_id,
              sent: pushResult.sent,
              failed: pushResult.failed,
              errors: pushResult.errors,
            });
          }
        } catch (err) {
          logger.error({ message: 'Push notification failed', error: err });
        }

        if (isWalletFullyPaid) {
          try {
            const paymentPushResult = await notifyPaymentReceived(
              merchant_id,
              orderTotal,
              order.currency || 'NGN',
              orderNum,
              order.id
            );
            if (
              paymentPushResult.failed > 0 ||
              paymentPushResult.errors.length > 0
            ) {
              logger.warn({
                message: 'Payment push notification was not fully delivered',
                orderId: order.id,
                merchantId: merchant_id,
                sent: paymentPushResult.sent,
                failed: paymentPushResult.failed,
                errors: paymentPushResult.errors,
              });
            }
          } catch (err) {
            logger.error({
              message: 'Payment push notification failed',
              error: err,
            });
          }
        }
      });
    }

    const responseOrder = isWalletFullyPaid
      ? {
          ...order,
          payment_status: 'paid',
          payment_method: storeCreditFinalized
            ? walletAmountUsed > 0
              ? 'store_credit'
              : 'savings'
            : 'wallet',
        }
      : order;

    const responseBody = {
      order: responseOrder,
      // Wallet redemption details for UI display
      wallet: walletRedemptionResult
        ? {
            amountUsed: walletRedemptionResult.amountRedeemed,
            newBalance: walletRedemptionResult.newBalance,
            transactionId: walletRedemptionResult.transactionId,
          }
        : null,
      savings: savingsRedemptionResult
        ? {
            amountUsed: savingsRedemptionResult.amountRedeemed,
            goalId: savingsRedemptionResult.goalId,
            redemptionId: savingsRedemptionResult.redemptionId,
          }
        : null,
      // Amount still due to payment gateway (for payment initialization)
      amountDueToGateway: Math.max(amountDueToGateway, 0),
      ...(idempotencyReplayed ? { idempotency: { replayed: true } } : {}),
    };

    // Return order with wallet info for checkout UI
    return NextResponse.json(responseBody, {
      headers: idempotencyReplayed
        ? { 'x-idempotency-replayed': 'true' }
        : undefined,
      status: idempotencyReplayed ? 200 : 201,
    });
  } catch (error) {
    logger.error({ message: 'Unexpected error in POST /api/orders', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
