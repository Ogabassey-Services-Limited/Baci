import { useQuery } from '@tanstack/react-query';
import { ORDER_COLUMNS } from '@/constants/order-columns';
import { supabase } from '@/lib/supabase';
import { getJoinedRecord } from '@/lib/supabase-utils';
import type { OrderItem } from './order-types';
import { useMerchant } from './useMerchant';

interface OrderItemRow {
  id: string;
  product_id: string | null;
  name: string | null;
  quantity: number;
  price: number;
  products:
    | { name: string; images: string[] | null }
    | Array<{ name: string; images: string[] | null }>
    | null;
}

export function useOrder(orderId: string) {
  const { merchant } = useMerchant();

  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('id', orderId)
        .eq('merchant_id', merchant?.id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const [{ data: items }, { data: transactions }, { data: virtualAccount }] =
        await Promise.all([
          supabase
            .from('order_items')
            .select('id, product_id, name, quantity, price, products(name, images)')
            .eq('order_id', orderId),
          supabase
            .from('transactions')
            .select('amount')
            .eq('order_id', orderId)
            .eq('status', 'success'),
          supabase
            .from('order_payment_accounts')
            .select('account_number, bank_name, account_name')
            .eq('order_id', orderId)
            .maybeSingle(),
        ]);

      let recordedByName: string | null = null;
      let staffTerminal: {
        account_number: string;
        bank_name: string;
        account_name: string;
      } | null = null;

      if (order.recorded_by_user_id) {
        const { data: recUser } = await supabase
          .from('profiles')
          .select('display_name, full_name')
          .eq('id', order.recorded_by_user_id)
          .single();

        const fullName = recUser?.display_name || recUser?.full_name;
        if (fullName) {
          recordedByName = fullName.split(' ')[0];
        }

        const { data: staffMember } = await supabase
          .from('staff_members')
          .select('id')
          .eq('user_id', order.recorded_by_user_id)
          .eq('merchant_id', merchant?.id)
          .eq('status', 'active')
          .maybeSingle();

        if (staffMember) {
          const { data: terminal } = await supabase
            .from('virtual_terminals')
            .select('account_number, account_name, bank')
            .eq('staff_id', staffMember.id)
            .eq('active', true)
            .maybeSingle();

          if (terminal?.account_number) {
            staffTerminal = {
              account_number: terminal.account_number,
              bank_name: terminal.bank,
              account_name: terminal.account_name,
            };
          }
        }
      }

      const transactionTotal =
        transactions?.reduce((sum, transaction) => {
          return sum + (Number(transaction.amount) || 0);
        }, 0) || 0;
      const amountPaid = Math.max(
        Number(order.amount_paid) || 0,
        transactionTotal + (Number(order.wallet_amount_used) || 0)
      );
      const balance = Math.max(0, (Number(order.total) || 0) - amountPaid);
      const orderWithMeta = order as typeof order & {
        fulfillment_details?: { imei?: string; serialNumber?: string } | null;
      };

      return {
        ...order,
        amount_paid: amountPaid,
        balance,
        virtual_account: virtualAccount || null,
        staff_terminal: staffTerminal,
        recorded_by_name: recordedByName,
        fulfillment_details: orderWithMeta.fulfillment_details ?? null,
        items: (items as OrderItemRow[] | null)?.map((item): OrderItem => {
          const product = getJoinedRecord(item.products);
          const itemName = item.name ?? product?.name ?? 'Unnamed item';

          return {
            id: item.id,
            product_id: item.product_id ?? `custom-${item.id}`,
            name: itemName,
            product_name: itemName,
            quantity: item.quantity,
            price: item.price,
            image_url: product?.images?.[0],
          };
        }),
      };
    },
    enabled: !!orderId && !!merchant?.id,
  });
}
