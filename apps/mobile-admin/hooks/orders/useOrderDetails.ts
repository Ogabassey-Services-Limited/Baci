import type { OrderFulfillmentDetails } from '@baci/shared';
import { useQuery } from '@tanstack/react-query';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { ORDER_COLUMNS } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import { getJoinedRecord } from '@/lib/supabase-utils';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import { useBranchScope } from '../useBranchScope';
import { useMerchant } from '../useMerchant';

interface OrderItemRow {
  has_assurance: boolean | null;
  id: string;
  name: string | null;
  price: number;
  product_id: string | null;
  products:
    | {
        condition: string | null;
        images: string[] | null;
        name: string;
      }
    | Array<{
        condition: string | null;
        images: string[] | null;
        name: string;
      }>
    | null;
  quantity: number;
  variant_name: string | null;
}

export async function fetchOrderById(
  orderId: string,
  merchantId: string,
  scope: BranchScope = ALL_BRANCH_SCOPE
) {
  let orderQuery = supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .eq('merchant_id', merchantId);

  if (scope.type === 'branch') {
    orderQuery = orderQuery.eq('branch_id', scope.branchId);
  }

  const { data: order, error } = await orderQuery.single();

  if (error) {
    throw new Error(error.message);
  }

  const [
    { data: items, error: itemsError },
    { data: transactions, error: transactionsError },
    { data: virtualAccount, error: virtualAccountError },
  ] = await Promise.all([
    supabase
      .from('order_items')
      .select(
        'id, product_id, has_assurance, variant_name, name, quantity, price, products(name, images, condition)'
      )
      .eq('order_id', orderId),
    supabase
      .from('transactions')
      .select('amount')
      .eq('order_id', orderId)
      .in('status', ['success', 'completed']),
    supabase
      .from('order_payment_accounts')
      .select('account_number, bank_name, account_name')
      .eq('order_id', orderId)
      .maybeSingle(),
  ]);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  if (virtualAccountError) {
    throw new Error(virtualAccountError.message);
  }

  let recordedByName: string | null = null;
  let staffTerminal: {
    account_name: string;
    account_number: string;
    bank_name: string;
  } | null = null;

  if (order.recorded_by_user_id) {
    const { data: recUser, error: recUserError } = await supabase
      .from('profiles')
      .select('display_name, full_name')
      .eq('id', order.recorded_by_user_id)
      .maybeSingle();

    if (recUserError) {
      // Auxiliary lookup; log and skip instead of failing the whole fetch.
      console.error('useOrderDetails profiles lookup error:', recUserError);
    }

    const fullName = recUser?.display_name || recUser?.full_name;
    if (fullName) {
      recordedByName = fullName.split(' ')[0];
    }

    const { data: staffMember, error: staffMemberError } = await supabase
      .from('staff_members')
      .select('id')
      .eq('user_id', order.recorded_by_user_id)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .maybeSingle();

    if (staffMemberError) {
      console.error(
        'useOrderDetails staff_members lookup error:',
        staffMemberError
      );
    }

    if (staffMember) {
      const { data: terminal, error: terminalError } = await supabase
        .from('virtual_terminals')
        .select('account_number, account_name, bank')
        .eq('staff_id', staffMember.id)
        .eq('active', true)
        .maybeSingle();

      if (terminalError) {
        console.error(
          'useOrderDetails virtual_terminals lookup error:',
          terminalError
        );
      }

      if (terminal?.account_number) {
        staffTerminal = {
          account_name: terminal.account_name,
          account_number: terminal.account_number,
          bank_name: terminal.bank,
        };
      }
    }
  }

  const transactionTotal =
    transactions?.reduce((sum, transaction) => {
      return sum + (Number(transaction.amount) || 0);
    }, 0) || 0;
  const amountPaid = transactionTotal + (Number(order.wallet_amount_used) || 0);
  const balance = Math.max(0, (Number(order.total) || 0) - amountPaid);
  const orderWithMeta = order as {
    fulfillment_details?: OrderFulfillmentDetails | null;
  };

  return {
    ...order,
    amount_paid: amountPaid,
    balance,
    fulfillment_details: orderWithMeta.fulfillment_details ?? null,
    items: ((items as OrderItemRow[] | null) ?? []).map((item) => {
      const product = getJoinedRecord(item.products);
      const itemName = item.name ?? product?.name ?? 'Unnamed item';

      return {
        condition: product?.condition ?? undefined,
        has_assurance: item.has_assurance ?? undefined,
        id: item.id,
        image_url: product?.images?.[0],
        name: itemName,
        price: item.price,
        product_id: item.product_id ?? `custom-${item.id}`,
        product_name: itemName,
        quantity: item.quantity,
        variant_name: item.variant_name ?? undefined,
      };
    }),
    recorded_by_name: recordedByName,
    staff_terminal: staffTerminal,
    virtual_account: virtualAccount || null,
  };
}

export function useOrder(orderId: string) {
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const branchScopeKey = getBranchScopeKey(scope);

  return useQuery({
    enabled: !!orderId && !!merchant?.id,
    queryFn: () => {
      if (!merchant?.id) {
        throw new Error('Merchant ID is required');
      }

      return fetchOrderById(orderId, merchant.id, scope);
    },
    queryKey: ['order', orderId, merchant?.id, branchScopeKey],
  });
}
