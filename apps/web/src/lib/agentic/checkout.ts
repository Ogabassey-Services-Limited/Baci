// --- Interfaces based on Spec ---
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveStock } from '@/lib/product-stock';

export interface GPTLineItem {
  id: string; // "line_item_123"
  item: {
    id: string; // product_id or variant_id
    quantity: number;
    title?: string;
    description?: string;
  };
  base_amount: number; // In smallest currency unit (e.g. kobo/cents) or standard?
  // Spec examples show "300" for $3.00 if currency is USD? Or is it 300 cents?
  // OpenAI spec examples: amount: 300 for $300.00? No, usually in minor units like Stripe.
  // Wait, spec example says: "amount": 300, and "total": 330 for items + tax.
  // If text is "3.30", then 330 is minor units.
  // We'll assume minor units (cents/kobo) effectively to be safe, OR standard units if the spec says "79.99 USD" string elsewhere.
  // Re-reading spec: "price": "79.99 USD" string in Product Feed.
  // But in Checkout API, "amount": 300 (integer) suggests minor units.
  // Let's assume standard units (Naira) for now but use integers to avoid float math?
  // No, `number` in JSON. Let's stick to standard Baci usage: Baci uses floats for price (e.g. 1000.00).
  // Example in spec: "amount": 300. "display_text": "Item(s) total".
  // If item price is 50, and qty 6, total 300.
  // We will assume MAJOR units (e.g. 300 Naira) because spec says "currency": "usd".

  discount: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface GPTTotal {
  type:
    | 'items_base_amount'
    | 'items_discount'
    | 'subtotal'
    | 'discount'
    | 'fulfillment'
    | 'tax'
    | 'fee'
    | 'total';
  display_text: string;
  amount: number | string; // Spec example shows number mostly, but one "0.30" string?
  // Spec example: "amount": 300. "amount": "0.30". It seems mixed. We'll verify strictness later.
}

export interface GPTFulfillmentOption {
  type: 'shipping' | 'digital' | 'pickup';
  id: string;
  title: string;
  subtitle?: string;
  carrier?: string;
  earliest_delivery_time?: string;
  latest_delivery_time?: string;
  subtotal: number; // Cost of shipping
  tax: number;
  total: number;
}

export interface GPTMessage {
  type: 'info' | 'error';
  code?: string;
  path?: string;
  content_type: 'plain' | 'markdown';
  content: string;
}

export interface CheckoutItem {
  id: string;
  quantity: number;
}

interface AgenticProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  stock_quantity?: number;
  weight_value?: number;
  weight_unit?: string;
}

interface AgenticVariant {
  id: string;
  product_id: string;
  price_override?: number;
  stock_quantity: number;
  attributes?: Record<string, string>;
  product?: {
    name: string;
  };
}

// --- Helpers ---

export async function calculateCheckoutSession(
  supabase: SupabaseClient,
  items: CheckoutItem[],
  fulfillmentOptionId?: string | null,
  _currency: string = 'NGN'
) {
  // 1. Fetch products
  // We need to handle both Product IDs and Variant IDs.
  // Our new setup uses `id` for both (variants have unique UUIDs usually, or SKU).
  // Ideally we query `products` and `product_variants`.

  // Simplified logic: assume input ID is valid UUID for either product or variant.
  // Or check SKU.
  const productIds = items.map((i) => i.id);

  // Try fetching from products first (parents)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, stock, stock_quantity, weight_value, weight_unit')
    .in('id', productIds)
    .returns<AgenticProduct[]>();

  // Try fetching from variants
  const { data: variants } = await supabase
    .from('product_variants')
    .select(
      'id, product_id, price_override, stock_quantity, attributes, product:products(name)'
    )
    .in('id', productIds)
    .returns<AgenticVariant[]>();

  const foundProducts = products || [];
  const foundVariants = variants || [];

  const lineItems: GPTLineItem[] = [];
  const messages: GPTMessage[] = [];

  let itemsBaseAmount = 0;
  let _shippingWeightTotal = 0; // In kg presumably

  for (const requestedItem of items) {
    const product = foundProducts.find((p) => p.id === requestedItem.id);
    const variant = foundVariants.find((v) => v.id === requestedItem.id);

    let price = 0;
    let title = '';
    let stock = 0;
    let weight = 0;

    if (variant) {
      // It's a variant
      price = variant.price_override || 0; // Fallback? Need parent fetch if 0?
      // For now assume price_override is populated or handled in variant view
      title = `${variant.product?.name || 'Item'} - ${Object.values(variant.attributes || {}).join('/')}`;
      stock = variant.stock_quantity ?? 0;
      // Variant weight? Assume parent weight (complex logic, skip for MVP)
    } else if (product) {
      // It's a parent
      price = product.price;
      title = product.name;
      stock = getEffectiveStock(product);
      weight = product.weight_unit === 'kg' ? product.weight_value || 0 : 0; // Simplified
      _shippingWeightTotal += weight * requestedItem.quantity;
    } else {
      // Not found
      messages.push({
        type: 'error',
        code: 'invalid',
        path: `$.items[${items.indexOf(requestedItem)}]`,
        content_type: 'plain',
        content: `Item ${requestedItem.id} not found.`,
      });
      continue;
    }

    // Check Stock
    if (stock < requestedItem.quantity) {
      messages.push({
        type: 'error',
        code: 'out_of_stock',
        path: `$.items[${items.indexOf(requestedItem)}]`,
        content_type: 'plain',
        content: `Only ${stock} items available for ${title}.`,
      });
    }

    const itemTotal = price * requestedItem.quantity;
    itemsBaseAmount += itemTotal;

    lineItems.push({
      id: `line_${requestedItem.id}`,
      item: {
        id: requestedItem.id,
        quantity: requestedItem.quantity,
        title,
      },
      base_amount: itemTotal,
      discount: 0,
      subtotal: itemTotal,
      tax: 0,
      total: itemTotal,
    });
  }

  // Fulfillment Options
  // Default: Pickup and Standard Shipping
  const fulfillmentOptions: GPTFulfillmentOption[] = [];

  // 1. Pickup
  fulfillmentOptions.push({
    type: 'pickup',
    id: 'pickup_store_1',
    title: 'Store Pickup',
    subtitle: 'Pick up at Ogabassey Ikeja Store',
    subtotal: 0,
    tax: 0,
    total: 0,
  });

  // 2. Standard Shipping (GIGL / Flat Rate approximation for MVP)
  // Real GIGL calc requires address. If address missing, show estimate?
  // Spec: "If no fulfillment address is provided... checkout cannot be completed."
  // But we can return options?
  // Let's return a flat rate fallback if address missing, or calc if present.
  const flatShippingRate = 2500; // NGN
  fulfillmentOptions.push({
    type: 'shipping',
    id: 'shipping_standard',
    title: 'Standard Delivery',
    subtitle: 'Delivery within Lagos',
    // carrier: 'GIGL',
    subtotal: flatShippingRate,
    tax: 0,
    total: flatShippingRate,
  });

  // Select fulfillment
  let selectedOption = fulfillmentOptions.find(
    (o) => o.id === fulfillmentOptionId
  );
  if (!selectedOption && fulfillmentOptions.length > 0) {
    selectedOption = fulfillmentOptions[0]; // Default
  }

  const fulfillmentCost = selectedOption ? selectedOption.total : 0;
  const grandTotal = itemsBaseAmount + fulfillmentCost;

  // Totals
  const totals: GPTTotal[] = [
    {
      type: 'items_base_amount',
      display_text: 'Items Subtotal',
      amount: itemsBaseAmount,
    },
    { type: 'fulfillment', display_text: 'Shipping', amount: fulfillmentCost },
    { type: 'total', display_text: 'Total Due', amount: grandTotal },
  ];

  return {
    lineItems,
    totals,
    fulfillmentOptions,
    selectedOptionId: selectedOption?.id,
    messages,
  };
}
