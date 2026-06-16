import * as Crypto from 'expo-crypto';

export interface MobileCheckoutIdempotencyState {
  checkoutFingerprint: string;
  key: string;
}

interface MobileCheckoutIdempotencyRef {
  current: MobileCheckoutIdempotencyState | null;
}

interface MobileCheckoutIdempotencyItem {
  assuranceFee?: number | null;
  hasAssurance?: boolean | null;
  id: string;
  price: number;
  productId?: string | null;
  quantity: number;
  variantAttributes?: Record<string, string> | null;
  variantId?: string | null;
}

interface MobileCheckoutIdempotencyInput {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: string;
  discountAmount?: number | null;
  discountCode?: string | null;
  items: readonly MobileCheckoutIdempotencyItem[];
  savingsAmount?: number | null;
  savingsGoalId?: string | null;
  selectedQuoteId?: string | null;
  shippingAddress: {
    address: string;
    city: string;
    firstName: string;
    lastName: string;
    notes?: string | null;
    state: string;
  };
  shippingFee: number;
  shippingProvider?: string | null;
  subtotal: number;
  taxAmount?: number | null;
  walletAmount?: number | null;
}

export interface MobileCheckoutOrderItemInput {
  image_url?: string;
  name: string;
  negotiatedPrice?: number;
  price: number;
  product_id: string;
  quantity: number;
  variant_attributes?: Record<string, string>;
  variant_id?: string;
  hasAssurance?: boolean;
  assuranceRate?: number;
}

export interface MobileCheckoutOrderItemPayload {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
  variant_id?: string;
  variant_attributes?: Record<string, string>;
  has_assurance: boolean;
  assurance_fee: number;
}

function normalizeString(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeAttributes(
  attributes: Record<string, string> | null | undefined
) {
  if (!attributes) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [normalizeString(key), normalizeString(value)])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function buildMobileCheckoutFingerprint(
  input: MobileCheckoutIdempotencyInput
) {
  const items = input.items
    .map((item) => ({
      assuranceFee: normalizeNumber(item.assuranceFee),
      hasAssurance: Boolean(item.hasAssurance),
      id: normalizeString(item.id),
      price: normalizeNumber(item.price),
      productId: normalizeString(item.productId ?? item.id),
      quantity: normalizeNumber(item.quantity),
      variantAttributes: normalizeAttributes(item.variantAttributes),
      variantId: normalizeString(item.variantId),
    }))
    .sort((left, right) => {
      const productComparison = left.productId.localeCompare(right.productId);
      if (productComparison !== 0) {
        return productComparison;
      }

      const variantComparison = left.variantId.localeCompare(right.variantId);
      if (variantComparison !== 0) {
        return variantComparison;
      }

      const idComparison = left.id.localeCompare(right.id);
      if (idComparison !== 0) {
        return idComparison;
      }

      if (left.quantity !== right.quantity) {
        return left.quantity - right.quantity;
      }

      if (left.price !== right.price) {
        return left.price - right.price;
      }

      if (left.assuranceFee !== right.assuranceFee) {
        return left.assuranceFee - right.assuranceFee;
      }

      if (left.hasAssurance !== right.hasAssurance) {
        return left.hasAssurance ? 1 : -1;
      }

      return stableStringify(left.variantAttributes).localeCompare(
        stableStringify(right.variantAttributes)
      );
    });

  return JSON.stringify({
    customerEmail: normalizeString(input.customerEmail),
    customerName: normalizeString(input.customerName),
    customerPhone: normalizeString(input.customerPhone),
    deliveryMethod: normalizeString(input.deliveryMethod),
    discountAmount: normalizeNumber(input.discountAmount),
    // Stable code identity so two equal-amount codes never collide on retry.
    discountCode: normalizeString(input.discountCode) || null,
    items,
    savingsAmount: normalizeNumber(input.savingsAmount),
    savingsGoalId: normalizeString(input.savingsGoalId),
    selectedQuoteId: normalizeString(input.selectedQuoteId),
    shippingAddress: {
      address: normalizeString(input.shippingAddress.address),
      city: normalizeString(input.shippingAddress.city),
      firstName: normalizeString(input.shippingAddress.firstName),
      lastName: normalizeString(input.shippingAddress.lastName),
      notes: normalizeString(input.shippingAddress.notes),
      state: normalizeString(input.shippingAddress.state),
    },
    shippingFee: normalizeNumber(input.shippingFee),
    shippingProvider: normalizeString(input.shippingProvider),
    subtotal: normalizeNumber(input.subtotal),
    taxAmount: normalizeNumber(input.taxAmount),
    walletAmount: normalizeNumber(input.walletAmount),
  });
}

export function buildMobileCheckoutOrderItems(
  items: readonly MobileCheckoutOrderItemInput[],
  defaultAssuranceRate = 0.05
): MobileCheckoutOrderItemPayload[] {
  return items.map((item) => {
    const effectivePrice = item.negotiatedPrice ?? item.price;
    return {
      id: item.product_id,
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      price: effectivePrice,
      image_url: item.image_url,
      variant_id: item.variant_id,
      variant_attributes: item.variant_attributes,
      has_assurance: item.hasAssurance || false,
      assurance_fee: item.hasAssurance
        ? Math.round(
            effectivePrice *
              item.quantity *
              (item.assuranceRate ?? defaultAssuranceRate)
          )
        : 0,
    };
  });
}

export function calculateMobileCheckoutAssuranceFee(
  items: readonly MobileCheckoutOrderItemInput[],
  defaultAssuranceRate = 0.05
) {
  return items.reduce((sum, item) => {
    if (!item.hasAssurance) {
      return sum;
    }

    const effectivePrice = item.negotiatedPrice ?? item.price;
    return (
      sum +
      Math.round(
        effectivePrice *
          item.quantity *
          (item.assuranceRate ?? defaultAssuranceRate)
      )
    );
  }, 0);
}

export function buildMobileCheckoutOrderFingerprint({
  items,
  ...input
}: Omit<MobileCheckoutIdempotencyInput, 'items'> & {
  items: readonly MobileCheckoutOrderItemPayload[];
}) {
  return buildMobileCheckoutFingerprint({
    ...input,
    items: items.map((item) => ({
      assuranceFee: item.assurance_fee,
      hasAssurance: item.has_assurance,
      id: item.id,
      price: item.price,
      productId: item.product_id,
      quantity: item.quantity,
      variantAttributes: item.variant_attributes,
      variantId: item.variant_id,
    })),
  });
}

export function getMobileCheckoutIdempotencyKey(
  ref: MobileCheckoutIdempotencyRef,
  checkoutFingerprint: string
) {
  if (ref.current?.checkoutFingerprint === checkoutFingerprint) {
    return ref.current.key;
  }

  const key = Crypto.randomUUID();
  ref.current = { checkoutFingerprint, key };
  return key;
}

export function clearMobileCheckoutIdempotencyKey(
  ref: MobileCheckoutIdempotencyRef,
  checkoutFingerprint?: string
) {
  if (
    checkoutFingerprint &&
    ref.current?.checkoutFingerprint !== checkoutFingerprint
  ) {
    return;
  }

  ref.current = null;
}
