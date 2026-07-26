import type {
  ChatToolTenantClient,
  VirtualAccountResult,
} from './chat-tool-result-types';
import type { CreateVirtualAccountParams } from './chat-tools';

export async function createVirtualAccountForTenant(
  params: CreateVirtualAccountParams,
  sessionId: string,
  scoped: ChatToolTenantClient
): Promise<VirtualAccountResult> {
  const { merchantId, supabase } = scoped;

  try {
    const subtotal = params.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const { data: order, error: orderError } = await supabase
      .from('chat_orders')
      .insert({
        merchant_id: merchantId,
        session_id: sessionId,
        customer_email: params.customerEmail,
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        items: params.items,
        subtotal,
        status: 'pending_payment',
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('[Chat Tools] Order creation error:', orderError);
      return { success: false, error: 'Failed to create order' };
    }

    console.warn(
      '[Chat Tools] Virtual account creation blocked — Kuda API not integrated. Order:',
      order.id
    );
    return {
      success: false,
      orderId: order.id,
      error:
        'Bank transfer payment is temporarily unavailable. Please use card payment at checkout or contact support.',
    };
  } catch (err) {
    console.error('[Chat Tools] Virtual account error:', err);
    return { success: false, error: 'Failed to generate payment account' };
  }
}
