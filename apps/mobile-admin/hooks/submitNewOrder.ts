import type { OrderSource, PaymentStatus } from '@baci/shared';
import type { QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type { MutableRefObject } from 'react';
import { Alert } from 'react-native';
import type {
  CustomerInfo,
  DeliveryInfo,
  OrderItem,
  ShippingAddress,
} from '@/components/orders/new-order.types';
import { createManualOrderWithItems } from '@/lib/manual-order-persistence';
import {
  sanitizeAddress,
  sanitizeCustomerName,
  sanitizeEmail,
  sanitizeNotes,
  sanitizePhone,
  sanitizeText,
} from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';

interface SubmitNewOrderParams {
  customer: CustomerInfo;
  deliveryInfo: DeliveryInfo;
  discount: number;
  merchantId?: string;
  merchantCurrency?: string | null;
  notes: string;
  orderItems: OrderItem[];
  partialAmount: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  queryClient: QueryClient;
  sameAsCustomer: boolean;
  selectedChannel: OrderSource;
  selectedBranchId?: string | null;
  setIsSubmitting: (value: boolean) => void;
  setLastOrderId: (value: string | null) => void;
  setShowSuccessModal: (value: boolean) => void;
  shippingFee: number;
  subtotal: number;
  taxesToUse: number;
  total: number;
  userId?: string;
  submittingRef: MutableRefObject<boolean>;
}

export async function submitNewOrder({
  customer,
  deliveryInfo,
  discount,
  merchantId,
  merchantCurrency,
  notes,
  orderItems,
  partialAmount,
  paymentMethod,
  paymentStatus,
  queryClient,
  sameAsCustomer,
  selectedChannel,
  selectedBranchId,
  setIsSubmitting,
  setLastOrderId,
  setShowSuccessModal,
  shippingFee,
  subtotal,
  taxesToUse,
  total,
  userId,
  submittingRef,
}: SubmitNewOrderParams) {
  if (submittingRef.current) {
    return;
  }
  if (!customer.id || !customer.name) {
    Alert.alert('Required', 'Please select a customer for this order');
    return;
  }
  if (!merchantId) {
    Alert.alert(
      'Unavailable',
      'Merchant information is still loading. Please try again.'
    );
    return;
  }
  if (orderItems.length === 0) {
    Alert.alert('Required', 'Please add at least one product');
    return;
  }

  submittingRef.current = true;
  setIsSubmitting(true);

  try {
    const orderNumber = generateOrderNumber();
    const sanitizedCustomerName =
      sanitizeCustomerName(customer.name) || 'Walk-in Customer';
    const sanitizedCustomerEmail = customer.email
      ? sanitizeEmail(customer.email)
      : null;
    const sanitizedCustomerPhone = customer.phone
      ? sanitizePhone(customer.phone)
      : null;
    const sanitizedCustomerAddress = customer.address
      ? sanitizeAddress(customer.address)
      : '';
    const sanitizedNotes = notes.trim() ? sanitizeNotes(notes) : null;
    const parsedPartialAmount = Number.parseFloat(partialAmount);
    if (
      paymentStatus === 'partially_paid' &&
      (Number.isNaN(parsedPartialAmount) || parsedPartialAmount < 0)
    ) {
      throw new Error('Invalid payment amount');
    }
    const shippingAddress: ShippingAddress = sameAsCustomer
      ? {
          address: sanitizedCustomerAddress,
          name: sanitizedCustomerName,
          phone: sanitizedCustomerPhone || '',
        }
      : {
          address: sanitizeAddress(deliveryInfo.address),
          city: sanitizeText(deliveryInfo.city, 100),
          name: sanitizeCustomerName(deliveryInfo.name),
          phone: sanitizePhone(deliveryInfo.phone),
          state: sanitizeText(deliveryInfo.state, 100),
        };
    const validatedBranchId = await validateSelectedBranch(
      selectedBranchId,
      merchantId
    );

    const createdOrder = await createManualOrderWithItems(
      {
        deleteOrder: (orderId) =>
          supabase
            .from('orders')
            .delete()
            .eq('id', orderId)
            .eq('merchant_id', merchantId),
        insertOrder: (order) =>
          supabase.from('orders').insert(order).select('id').single(),
        insertOrderItems: (items) => supabase.from('order_items').insert(items),
      },
      {
        buildItems: (orderId) =>
          orderItems.map((item) => ({
            condition: item.condition ?? null,
            item_description: item.details
              ? sanitizeText(item.details, 1000)
              : null,
            name: sanitizeText(item.name, 200),
            order_id: orderId,
	            price: item.price,
	            product_id: item.is_custom ? null : item.product_id,
	            product_match_status:
	              item.product_match_status ?? (item.is_custom ? 'custom' : 'linked'),
	            quantity: item.quantity,
            variant_id: item.is_custom ? null : (item.variant_id ?? null),
            variant_name: item.is_custom ? null : (item.variant_name ?? null),
          })),
        order: {
          amount_paid:
            paymentStatus === 'partially_paid'
              ? parsedPartialAmount
              : paymentStatus === 'paid'
                ? total
                : 0,
          branch_id: validatedBranchId,
          currency: merchantCurrency || 'NGN',
          customer_email: sanitizedCustomerEmail,
          customer_id: customer.id,
          customer_name: sanitizedCustomerName,
          customer_phone: sanitizedCustomerPhone,
          discount_amount: discount,
          merchant_id: merchantId,
          notes: sanitizedNotes,
          order_number: orderNumber,
          payment_method:
            paymentStatus === 'paid' || paymentStatus === 'partially_paid'
              ? paymentMethod
              : null,
          payment_status: paymentStatus,
          recorded_by_user_id: userId || null,
          shipping_address: shippingAddress,
          shipping_fee: shippingFee,
          shipping_status: 'pending',
          source: selectedChannel,
          subtotal,
          tax_amount: taxesToUse,
          total,
        },
      }
    );

    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-counts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

    setLastOrderId(createdOrder.id);
    setShowSuccessModal(true);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Failed to create order';
    Alert.alert('Error', message);
  } finally {
    submittingRef.current = false;
    setIsSubmitting(false);
  }
}

async function validateSelectedBranch(
  selectedBranchId: string | null | undefined,
  merchantId: string
) {
  if (!selectedBranchId) {
    return null;
  }

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('id', selectedBranchId)
    .eq('merchant_id', merchantId)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to validate selected branch');
  }
  if (!data) {
    throw new Error('Selected branch is not available for this merchant');
  }

  return data.id;
}

function generateOrderNumber() {
  const date = new Date();
  const prefix = 'ORD';
  const datePart = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getFullYear()).slice(-2)}`;
  const randomPart = Crypto.randomUUID()
    .replace(/-/g, '')
    .substring(0, 6)
    .toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}
