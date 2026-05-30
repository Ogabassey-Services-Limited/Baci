import type { CreateOrderRequest } from './orders';

type BuildMobileOrderPayloadOptions = {
  merchantId: string;
  userId?: string;
};

export function buildMobileOrderPayload(
  validatedRequest: CreateOrderRequest,
  { merchantId, userId }: BuildMobileOrderPayloadOptions
) {
  return {
    merchant_id: merchantId,
    customer_email: validatedRequest.customer_email,
    customer_name: validatedRequest.customer_name,
    customer_phone: validatedRequest.customer_phone,
    items: validatedRequest.items.map((item) => ({
      id: item.id,
      condition: item.condition,
      product_id: item.product_id || item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      image_url: item.image_url,
      value: Math.round(item.price * item.quantity),
      variant_id: item.variant_id,
      variant_attributes: item.variant_attributes || {},
      has_assurance: item.has_assurance ?? false,
      assurance_fee: item.assurance_fee ?? 0,
      voucher_award_id: item.voucher_award_id,
      voucher_token: item.voucher_token,
    })),
    subtotal: validatedRequest.subtotal,
    shipping_fee: validatedRequest.shipping_fee,
    tax_amount: validatedRequest.tax_amount ?? 0,
    discount_amount: validatedRequest.discount_amount ?? 0,
    payment_method: validatedRequest.payment_method,
    selected_quote_id: validatedRequest.selected_quote_id ?? null,
    shipping_provider: validatedRequest.shipping_provider ?? null,
    payment_status:
      validatedRequest.payment_method === 'pay_on_delivery'
        ? 'pending'
        : 'unpaid',
    shipping_status: 'pending',
    shipping_address: {
      firstName: validatedRequest.shipping_address.firstName,
      lastName: validatedRequest.shipping_address.lastName,
      address: validatedRequest.shipping_address.address,
      city: validatedRequest.shipping_address.city,
      state: validatedRequest.shipping_address.state,
      notes: validatedRequest.shipping_address.notes || '',
    },
    source: 'mobile_app',
    ...(userId && { user_id: userId }),
    ...(validatedRequest.use_wallet_credit === true &&
      typeof validatedRequest.wallet_amount === 'number' &&
      validatedRequest.wallet_amount > 0 && {
        use_wallet_credit: validatedRequest.use_wallet_credit,
        wallet_amount: validatedRequest.wallet_amount,
      }),
    ...(validatedRequest.use_savings_credit === true &&
      typeof validatedRequest.savings_goal_id === 'string' &&
      typeof validatedRequest.savings_amount === 'number' &&
      validatedRequest.savings_amount > 0 && {
        savings_amount: validatedRequest.savings_amount,
        savings_goal_id: validatedRequest.savings_goal_id,
        use_savings_credit: validatedRequest.use_savings_credit,
      }),
  };
}
