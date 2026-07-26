import type {
  ChatToolTenantClient,
  PaymentStatusResult,
} from './chat-tool-result-types';
import type { CheckPaymentStatusParams } from './chat-tools';

function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: 'account_number' | 'bank_name'
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function checkPaymentStatusForTenant(
  params: CheckPaymentStatusParams,
  sessionId: string,
  scoped: ChatToolTenantClient
): Promise<PaymentStatusResult> {
  const { merchantId, supabase } = scoped;

  try {
    let order: {
      id: string;
      status: string;
      paid_at: string | null;
      created_at: string;
      subtotal: number;
      virtual_account_number: string | null;
      virtual_account_bank: string | null;
      metadata: Record<string, unknown> | null;
    } | null = null;

    if (params.orderId) {
      const { data } = await supabase
        .from('chat_orders')
        .select(
          'id, status, paid_at, created_at, subtotal, virtual_account_number, virtual_account_bank, metadata'
        )
        .eq('id', params.orderId)
        .eq('merchant_id', merchantId)
        .eq('session_id', sessionId)
        .maybeSingle();
      if (data) order = data;
    }

    if (!order && params.customerEmail) {
      const { data } = await supabase
        .from('chat_orders')
        .select(
          'id, status, paid_at, created_at, subtotal, virtual_account_number, virtual_account_bank, metadata'
        )
        .eq('customer_email', params.customerEmail)
        .eq('merchant_id', merchantId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) order = data;
    }

    if (!order) return { status: 'not_found' };

    const accountNumber =
      order.virtual_account_number ||
      getMetadataString(order.metadata, 'account_number');
    const bankName =
      order.virtual_account_bank ||
      getMetadataString(order.metadata, 'bank_name');

    if (order.status === 'paid') {
      return {
        status: 'paid',
        orderId: order.id,
        paidAt: order.paid_at || undefined,
        amount: order.subtotal,
      };
    }

    const createdAt = new Date(order.created_at);
    const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    if (new Date() > expiresAt) {
      return { status: 'expired', orderId: order.id };
    }

    return {
      status: 'pending',
      orderId: order.id,
      amount: order.subtotal,
      accountNumber: accountNumber || undefined,
      bankName: bankName || undefined,
    };
  } catch (err) {
    console.error('[Chat Tools] Payment status error:', err);
    return { status: 'not_found' };
  }
}
