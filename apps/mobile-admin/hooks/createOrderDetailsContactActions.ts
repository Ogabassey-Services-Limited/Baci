import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Share } from 'react-native';
import { extractOrderDeliveryAddress } from '@/lib/orders';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';

interface CreateOrderDetailsContactActionsParams {
  formatPrice: (amount: number) => string;
  merchant:
    | {
        business_address?: string | null;
        business_name?: string | null;
      }
    | null
    | undefined;
  order: OrderDetailsRecord | undefined;
  riderPhone: string;
  savedRiders: string[];
  setSavedRiders: (value: string[]) => void;
}

export function createOrderDetailsContactActions({
  formatPrice,
  merchant,
  order,
  riderPhone,
  savedRiders,
  setSavedRiders,
}: CreateOrderDetailsContactActionsParams) {
  const handleSaveRider = async (phone: string) => {
    if (!phone || savedRiders.includes(phone)) {
      return;
    }

    const nextRiders = [...savedRiders, phone];
    setSavedRiders(nextRiders);
    await AsyncStorage.setItem('saved_riders', JSON.stringify(nextRiders));
  };

  const handleSendOrderDetailsToRider = async () => {
    if (!order) {
      return;
    }
    if (!riderPhone) {
      Alert.alert('Required', 'Please enter a rider phone number');
      return;
    }

    await handleSaveRider(riderPhone);

    const shippingAddress =
      order.shipping_address && typeof order.shipping_address === 'object'
        ? order.shipping_address
        : null;
    const deliveryAddress =
      extractOrderDeliveryAddress(order.shipping_address) || '';
    const deliveryCityState = [shippingAddress?.city, shippingAddress?.state]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ');
    const amountToCollect =
      order.payment_method === 'pay_on_delivery'
        ? `\n*Amount to Collect:* ${formatPrice(order.balance || 0)}`
        : '';

    const message = `
📦 *New Order Dispatch*
Order #${order.order_number}

*Pickup:*
${merchant?.business_name || 'Store'}
${merchant?.business_address || ''}

*Deliver to:*
${order.customer_name}
${deliveryAddress}
${deliveryCityState}
Phone: ${order.customer_phone?.trim() || 'N/A'}
${amountToCollect}
`.trim();

    const url = `https://wa.me/${riderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp');
    });
  };

  const handleSendRiderToCustomer = () => {
    if (!order) {
      return;
    }

    const customerPhone = order.customer_phone?.trim();
    const dispatchPhone = order.self_fulfillment_data?.dispatchPhone?.trim();
    const carrierName =
      order.self_fulfillment_data?.carrierName?.trim() || 'Dispatch Rider';

    if (!customerPhone) {
      return;
    }
    if (!dispatchPhone) {
      Alert.alert(
        'Rider details unavailable',
        'Save a dispatch rider first before sharing rider details with the customer.'
      );
      return;
    }

    const message = `
🚚 *Order Update*
Your order #${order.order_number} is on the way!

${carrierName}: ${dispatchPhone}
Please keep your phone available.

Thank you for choosing ${merchant?.business_name || 'us'}!
`.trim();

    const url = `https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp');
    });
  };

  const handleCall = () => {
    const phone = order?.customer_phone?.trim();
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEmail = () => {
    if (order?.customer_email) {
      Linking.openURL(`mailto:${order.customer_email}`);
    }
  };

  const handleWhatsApp = () => {
    const phone = order?.customer_phone?.trim();
    if (phone) {
      Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Order ${order?.order_number} details for ${order?.customer_name}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return {
    handleCall,
    handleEmail,
    handleSaveRider,
    handleSendOrderDetailsToRider,
    handleSendRiderToCustomer,
    handleShare,
    handleWhatsApp,
  };
}
