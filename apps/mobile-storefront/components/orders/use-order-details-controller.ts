import type { RealtimeChannel } from '@supabase/supabase-js';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import type { OrderDetailsInsurancePolicy } from '@/components/orders/OrderDetailsInsuranceCard';
import { SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';
import { useReceiptPreview } from '@/hooks/use-receipt-preview';
import { useMerchantReceiptInfo } from '@/hooks/use-receipts';
import { BACI_GOOGLE_REVIEW_URL } from '@/lib/post-purchase-actions';
import { supabase } from '@/lib/supabase';
import { isOrderRealtimePayload } from '@/lib/validation';
import { useAuthStore } from '@/stores/auth-store';
import { getOrderTrackingUrl, mapOrderDetails } from './order-details.helpers';
import type { OrderDetails, RawOrderDetails } from './OrderDetailsScreen.types';
import { createLogger } from '@/lib/logger';

const log = createLogger('OrderDetails');

export function useOrderDetailsController() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const { data: merchantInfo } = useMerchantReceiptInfo();
  const receiptPreview = useReceiptPreview();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [insurancePolicy, setInsurancePolicy] =
    useState<OrderDetailsInsurancePolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!id) return;
    if (!user?.id || !customer?.id) {
      setError('Please sign in to view order details');
      setIsLoading(false);
      return;
    }

    let ignore = false;
    const fetchOrder = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            shipping_status,
            subtotal,
            shipping_fee,
            tax_amount,
            discount_amount,
            total,
            payment_method,
            payment_status,
            created_at,
            updated_at,
            shipping_address,
            tracking_number,
            shipping_provider,
            notes,
            order_items (
              id,
              product_id,
              name,
              quantity,
              price,
              has_assurance,
              assurance_fee,
              products (
                slug,
                images
              )
            )
          `)
          .eq('id', id)
          .eq('customer_id', customer.id)
          .single();

        if (fetchError) throw fetchError;
        if (ignore) return;
        setOrder(mapOrderDetails(data as RawOrderDetails));

        const { data: policies, error: policyError } = await supabase
          .from('order_insurance_policies')
          .select(
            'mycover_policy_number, coverage_amount, premium_amount, status, claim_status, policy_start_date, policy_expiry_date, certificate_url, provider_name, policy_type, created_at'
          )
          .eq('order_id', id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (ignore) return;
        if (policyError) {
          log.warn('Error fetching order insurance policy:', policyError);
        } else if (policies && policies.length > 0) {
          setInsurancePolicy(policies[0] as OrderDetailsInsurancePolicy);
        }

        setError(null);
      } catch (err) {
        if (ignore) return;
        log.error('Error fetching order:', err);
        setError('Failed to load order details');
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    fetchOrder();
    return () => {
      ignore = true;
    };
  }, [id, user?.id, customer?.id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          log.debug('Order updated in realtime:', payload);
          if (!isOrderRealtimePayload(payload)) {
            log.warn('Invalid order realtime payload:', payload);
            return;
          }

          setOrder((prevOrder) =>
            prevOrder
              ? {
                  ...prevOrder,
                  shipping_status:
                    payload.new.shipping_status ?? prevOrder.shipping_status,
                  tracking_number:
                    payload.new.tracking_number ?? prevOrder.tracking_number,
                  shipping_provider:
                    payload.new.shipping_provider ??
                    prevOrder.shipping_provider,
                  updated_at: payload.new.updated_at ?? prevOrder.updated_at,
                }
              : prevOrder
          );
        }
      )
      .subscribe((status) => {
        log.debug('Realtime subscription status:', status);
      });

    channelRef.current = channel;
    return () => {
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      if (typeof channel.unsubscribe === 'function') {
        void channel.unsubscribe();
      } else {
        void supabase.removeChannel(channel);
      }
    };
  }, [id]);

  const handleTrackOrder = () => {
    const trackingUrl = getOrderTrackingUrl(
      order?.tracking_number,
      order?.shipping_provider
    );

    if (!order?.tracking_number) {
      Alert.alert(
        'Tracking Unavailable',
        'No tracking information is available for this order yet.'
      );
      return;
    }

    if (trackingUrl) {
      Linking.openURL(trackingUrl);
      return;
    }

    Alert.alert(
      'Tracking Unavailable',
      'No tracking link is available for this shipping provider.'
    );
  };

  const handleContactSupport = () => {
    Linking.openURL(
      `https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent('Hi, I need help with my order')}`
    );
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/orders/index');
  };

  return {
    error,
    handleCallRider: () => {
      const riderPhone = merchantInfo?.rider_phone_number?.trim();
      if (!riderPhone) {
        Alert.alert(
          'Rider Contact Unavailable',
          'The rider phone number has not been added yet.'
        );
        return;
      }
      Linking.openURL(`tel:${riderPhone}`);
    },
    handleContactSupport,
    handleGoBack,
    handleLeaveGoogleReview: () => Linking.openURL(BACI_GOOGLE_REVIEW_URL),
    handleOpenProduct: (slug: string) => router.push(`/product/${slug}`),
    handleOpenReceipt: () =>
      order && receiptPreview.openPreviewByOrderId(order.id),
    handleReturnOrder: () => {
      Alert.alert(
        'Return Order',
        'In-app returns are coming next. For now, contact support to start a return for this order.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Contact Support', onPress: handleContactSupport },
        ]
      );
    },
    handleTrackOrder,
    insurancePolicy,
    isLoading,
    merchantInfo,
    order,
    receiptPreview,
  };
}
