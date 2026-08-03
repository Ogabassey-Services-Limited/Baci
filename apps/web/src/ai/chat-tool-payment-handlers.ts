import type { AgenticMerchantIdentity } from '@/lib/agentic/agentic-merchant-identity';
import { createChatToolSupabaseClient } from './chat-tool-handler-support';
import type {
  CheckPaymentStatusParams,
  CreateVirtualAccountParams,
} from './chat-tools';

interface VirtualAccountResult {
  success: boolean;
  orderId?: string;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  amount?: number;
  expiresAt?: string;
  error?: string;
}

export async function handleCreateVirtualAccount(
  params: CreateVirtualAccountParams,
  sessionId: string,
  merchant: AgenticMerchantIdentity
): Promise<VirtualAccountResult> {
  const supabase = createChatToolSupabaseClient(merchant, sessionId);

  try {
    const subtotal = params.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const { data: order, error: orderError } = await supabase
      .from('chat_orders')
      .insert({
        merchant_id: merchant.id,
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

    // Virtual account generation via Kuda API is not yet integrated.
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
  } catch (error) {
    console.error('[Chat Tools] Virtual account error:', error);
    return { success: false, error: 'Failed to generate payment account' };
  }
}

interface PaymentStatusResult {
  status: 'pending' | 'paid' | 'expired' | 'not_found';
  orderId?: string;
  paidAt?: string;
  amount?: number;
  accountNumber?: string;
  bankName?: string;
}

function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: 'account_number' | 'bank_name'
): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function handleCheckPaymentStatus(
  params: CheckPaymentStatusParams,
  sessionId: string,
  merchant: AgenticMerchantIdentity
): Promise<PaymentStatusResult> {
  const supabase = createChatToolSupabaseClient(merchant, sessionId);

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

    const orderSelect =
      'id, status, paid_at, created_at, subtotal, virtual_account_number, virtual_account_bank, metadata';

    if (params.orderId) {
      const { data } = await supabase
        .from('chat_orders')
        .select(orderSelect)
        .eq('id', params.orderId)
        .eq('merchant_id', merchant.id)
        .eq('session_id', sessionId)
        .maybeSingle();

      if (data) order = data;
    }

    if (!order && params.customerEmail) {
      const { data } = await supabase
        .from('chat_orders')
        .select(orderSelect)
        .eq('customer_email', params.customerEmail)
        .eq('merchant_id', merchant.id)
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

    const expiresAt = new Date(
      new Date(order.created_at).getTime() + 30 * 60 * 1000
    );
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
  } catch (error) {
    console.error('[Chat Tools] Payment status error:', error);
    return { status: 'not_found' };
  }
}
