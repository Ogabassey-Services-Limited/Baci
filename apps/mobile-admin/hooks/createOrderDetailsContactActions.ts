import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Share } from 'react-native';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { extractOrderDeliveryAddress } from '@/lib/orders';

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

function normalizeWhatsAppPhone(phone: string | null | undefined) {
  return phone?.replace(/\D/g, '') ?? '';
}

function isValidWhatsAppPhone(phone: string) {
  return phone.length >= 10 && phone.length <= 15;
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
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (
      !isValidWhatsAppPhone(normalizedPhone) ||
      savedRiders
        .map((savedPhone) => normalizeWhatsAppPhone(savedPhone))
        .includes(normalizedPhone)
    ) {
      return;
    }

    const nextRiders = [
      ...savedRiders
        .map((savedPhone) => normalizeWhatsAppPhone(savedPhone))
        .filter((savedPhone) => isValidWhatsAppPhone(savedPhone)),
      normalizedPhone,
    ];
    setSavedRiders(nextRiders);
    await AsyncStorage.setItem('saved_riders', JSON.stringify(nextRiders));
  };

  const handleSendOrderDetailsToRider = async () => {
    if (!order) {
      return;
    }

    const dispatchPhone = normalizeWhatsAppPhone(riderPhone);
    if (!dispatchPhone) {
      Alert.alert('Required', 'Please enter a rider phone number');
      return;
    }
    if (!isValidWhatsAppPhone(dispatchPhone)) {
      Alert.alert(
        'Invalid phone number',
        'Rider phone number is not valid for WhatsApp.'
      );
      return;
    }

    await handleSaveRider(dispatchPhone);

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

    const url = `https://wa.me/${dispatchPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp');
    });
  };

  const handleSendRiderToCustomer = () => {
    if (!order) {
      return;
    }

    const customerPhone = normalizeWhatsAppPhone(order.customer_phone);
    const dispatchPhone = normalizeWhatsAppPhone(
      order.self_fulfillment_data?.dispatchPhone
    );
    const carrierName =
      order.self_fulfillment_data?.carrierName?.trim() || 'Dispatch Rider';

    if (!customerPhone) {
      return;
    }
    if (!isValidWhatsAppPhone(customerPhone)) {
      Alert.alert(
        'Invalid phone number',
        'Customer phone number is not valid for WhatsApp.'
      );
      return;
    }
    if (!dispatchPhone) {
      Alert.alert(
        'Rider details unavailable',
        'Save a dispatch rider first before sharing rider details with the customer.'
      );
      return;
    }
    if (!isValidWhatsAppPhone(dispatchPhone)) {
      Alert.alert(
        'Invalid phone number',
        'Rider phone number is not valid for WhatsApp.'
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

    const url = `https://wa.me/${customerPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp');
    });
  };

  const handleCall = async () => {
    const phone = order?.customer_phone?.trim();
    if (phone) {
      try {
        await Linking.openURL(`tel:${phone}`);
      } catch {
        Alert.alert('Error', 'Could not open phone dialer');
      }
    }
  };

  const handleEmail = async () => {
    if (order?.customer_email) {
      try {
        await Linking.openURL(`mailto:${order.customer_email}`);
      } catch {
        Alert.alert('Error', 'Could not open email client');
      }
    }
  };

  const handleWhatsApp = () => {
    const phone = normalizeWhatsAppPhone(order?.customer_phone);
    if (!phone) {
      Alert.alert(
        'Invalid phone number',
        'Customer phone number is not valid for WhatsApp.'
      );
      return;
    }
    if (!isValidWhatsAppPhone(phone)) {
      Alert.alert(
        'Invalid phone number',
        'Customer phone number is not valid for WhatsApp.'
      );
      return;
    }

    Linking.openURL(`https://wa.me/${phone}`).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp');
    });
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
