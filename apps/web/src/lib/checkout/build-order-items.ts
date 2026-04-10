type CheckoutOrderItemCondition = 'new' | 'used' | 'open_box' | 'refurbished';

export interface CheckoutOrderItemInput {
  id: string | number;
  product_id?: string | number;
  condition?: CheckoutOrderItemCondition;
  name: string;
  quantity: number;
  price: number;
  negotiatedPrice?: number;
  image?: string;
  image_url?: string;
  variantId?: string;
  variantAttributes?: Record<string, string>;
  selectedColor?: string;
  selectedStorage?: string;
  hasAssurance?: boolean;
  assuranceRate?: number;
}

export interface CheckoutOrderItem {
  condition?: CheckoutOrderItemCondition;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  image?: string;
  image_url?: string;
  variantId?: string;
  variantAttributes: Record<string, string>;
  has_assurance: boolean;
  assurance_fee: number;
}

export function buildCheckoutOrderItems(
  cart: CheckoutOrderItemInput[]
): CheckoutOrderItem[] {
  return cart.map((item) => {
    const effectivePrice = item.negotiatedPrice ?? item.price;
    const variantAttributes = { ...(item.variantAttributes ?? {}) };

    if (item.selectedColor && !variantAttributes.color) {
      variantAttributes.color = item.selectedColor;
    }

    if (item.selectedStorage && !variantAttributes.storage) {
      variantAttributes.storage = item.selectedStorage;
    }

    return {
      condition: item.condition,
      product_id: String(item.product_id ?? item.id),
      name: item.name,
      quantity: item.quantity,
      price: effectivePrice,
      value: effectivePrice * item.quantity,
      image: item.image,
      image_url: item.image_url,
      variantId: item.variantId,
      variantAttributes,
      has_assurance: item.hasAssurance || false,
      assurance_fee: item.hasAssurance
        ? effectivePrice * (item.assuranceRate || 0.05)
        : 0,
    };
  });
}
